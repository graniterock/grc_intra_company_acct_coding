import os from "os";
import sql, { type ConnectionPool, type config as SqlConfig } from "mssql";

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const sqlConfig: SqlConfig = {
  server: required(process.env.SQL_SERVER_HOST, "SQL_SERVER_HOST"),
  database: required(process.env.SQL_SERVER_DATABASE, "SQL_SERVER_DATABASE"),
  user: required(process.env.SQL_SERVER_USER, "SQL_SERVER_USER"),
  password: required(process.env.SQL_SERVER_PASSWORD, "SQL_SERVER_PASSWORD"),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const portRaw = process.env.SQL_SERVER_PORT;
if (portRaw) {
  sqlConfig.port = Number.parseInt(portRaw, 10);
  if (Number.isNaN(sqlConfig.port)) {
    throw new Error("SQL_SERVER_PORT must be a valid integer");
  }
}

const connectionTimeoutRaw = process.env.SQL_SERVER_CONNECTION_TIMEOUT;
if (connectionTimeoutRaw) {
  sqlConfig.connectionTimeout = Number.parseInt(connectionTimeoutRaw, 10);
  if (Number.isNaN(sqlConfig.connectionTimeout)) {
    throw new Error(
      "SQL_SERVER_CONNECTION_TIMEOUT must be a valid integer (milliseconds)"
    );
  }
}

const requestTimeoutRaw = process.env.SQL_SERVER_REQUEST_TIMEOUT;
if (requestTimeoutRaw) {
  sqlConfig.requestTimeout = Number.parseInt(requestTimeoutRaw, 10);
  if (Number.isNaN(sqlConfig.requestTimeout)) {
    throw new Error(
      "SQL_SERVER_REQUEST_TIMEOUT must be a valid integer (milliseconds)"
    );
  }
}

const instanceName = process.env.SQL_SERVER_INSTANCE;
if (instanceName) {
  sqlConfig.options = {
    ...sqlConfig.options,
    instanceName,
  };
}

let pool: ConnectionPool | null = null;

const UPSERT_WORKING_TO_TEST_PROCEDURE =
  "dbo.GRC_Upsert_Intra_Ticket_AccountCode_Working_To_TEST";

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractSavedRowCount = (
  result: sql.IProcedureResult<unknown>
): number | null => {
  const returnValue = toFiniteNumber(result.returnValue);
  if (returnValue !== null) {
    return returnValue;
  }

  const scanRecord = (record: unknown): number | null => {
    if (!record || typeof record !== "object") {
      return null;
    }
    for (const value of Object.values(record as Record<string, unknown>)) {
      const numeric = toFiniteNumber(value);
      if (numeric !== null) {
        return numeric;
      }
    }
    return null;
  };

  if (Array.isArray(result.recordset)) {
    for (const entry of result.recordset) {
      const numeric = scanRecord(entry);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  if (Array.isArray(result.recordsets)) {
    for (const set of result.recordsets) {
      if (!Array.isArray(set)) continue;
      for (const entry of set) {
        const numeric = scanRecord(entry);
        if (numeric !== null) {
          return numeric;
        }
      }
    }
  }

  return null;
};

const TICKETS_QUERY = `
;WITH base_src AS (
    SELECT
        TicketNo,
        UniqueID,
        CAST(ItemNo AS int) AS ItemNo,
        LocationID,
        CustomerID,
        OrderID,
        ProductID,
        Description,
        TicketDate,
        Unit,
        Qty,
        UnitPrice,
        ExportStatus
    FROM Tkbatch
    WHERE VoidStatus <> 'V'
    
    UNION ALL
    
    SELECT
        TicketNo,
        UniqueID,
        CAST(ItemNo AS int) AS ItemNo,
        LocationID,
        CustomerID,
        OrderID,
        ProductID,
        Description,
        TicketDate,
        Unit,
        Qty,
        UnitPrice,
        ExportStatus
    FROM Tkhist1
    WHERE ExportStatus <> 'E'
      AND VoidStatus <> 'V'
),
other_src AS (
    SELECT
        TicketNo,
        UniqueID,
        CAST(ItemNo AS int) AS ItemNo,
        OtherChargeID AS ProductID,
        Description,
        Unit,
        Qty,
        UnitPrice
    FROM Tkeother
    WHERE VoidStatus <> 'V'
    
    UNION ALL
    
    SELECT
        TicketNo,
        UniqueID,
        CAST(ItemNo AS int) AS ItemNo,
        OtherChargeID AS ProductID,
        Description,
        Unit,
        Qty,
        UnitPrice
    FROM Tkohist
    WHERE VoidStatus <> 'V'
),

-- NEW: freight rows from Tkbatch and Tkhist1
freight_src AS (
    SELECT
        TicketNo,
        UniqueID,
        CAST(0 AS int) AS ItemNo,             -- placeholder; real ItemNo assigned later
        'AA' AS ProductID,
        'Freight' AS Description,
        CASE FreightUnitId
            WHEN 'T' THEN 'Ton'
            ELSE 'Per Load'
        END AS Unit,
        FreightQty     AS Qty,
        FreightRate    AS UnitPrice,
        FreightAmount
    FROM Tkbatch
    WHERE VoidStatus <> 'V'
      AND FreightAmount > 0

    UNION ALL

    SELECT
        TicketNo,
        UniqueID,
        CAST(0 AS int) AS ItemNo,
        'AA' AS ProductID,
        'Freight' AS Description,
        CASE FreightUnitId
            WHEN 'T' THEN 'Ton'
            ELSE 'Per Load'
        END AS Unit,
        FreightQty     AS Qty,
        FreightRate    AS UnitPrice,
        FreightAmount
    FROM Tkhist1
    WHERE ExportStatus <> 'E'
      AND VoidStatus <> 'V'
      AND FreightAmount > 0
),

base AS (
    SELECT
        b.TicketNo,
        b.UniqueID,
        b.ItemNo,
        b.LocationID,
        o.Description2 AS JobNumber,
        b.CustomerID,
        b.OrderID,
        b.ProductID,
        b.Description,
        b.TicketDate,
        b.Unit,
        b.Qty,
        b.UnitPrice,
        o.Description1 AS JobName,
        0 AS SourceRank
    FROM base_src AS b
    INNER JOIN Slordnam AS o ON b.OrderID    = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    WHERE b.ExportStatus <> 'E'
      AND c.ArType = 'C'
),
base_max AS (
    SELECT TicketNo, UniqueID, MAX(ItemNo) AS MaxBaseItemNo
    FROM base
    GROUP BY TicketNo, UniqueID
),

-- UPDATED: extras (other charges + freight)
e_raw AS (
    -- existing other charges
    SELECT
        e.TicketNo,
        b.UniqueID,
        e.ItemNo,
        b.LocationID,
        o.Description2 AS JobNumber,
        b.CustomerID,
        b.OrderID,
        e.ProductID,
        e.Description,
        b.TicketDate,
        e.Unit,
        e.Qty,
        e.UnitPrice,
        o.Description1 AS JobName,
        1 AS SourceRank,
        CAST(0 AS bit) AS IsFreight
    FROM other_src AS e
    INNER JOIN base_src AS b
        ON e.TicketNo = b.TicketNo
       AND e.UniqueID = b.UniqueID
    INNER JOIN Slordnam AS o ON b.OrderID    = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    WHERE b.ExportStatus <> 'E'
      AND c.ArType = 'C'

    UNION ALL

    -- NEW: freight rows as "other" lines
    SELECT
        f.TicketNo,
        b.UniqueID,
        f.ItemNo,
        b.LocationID,
        o.Description2 AS JobNumber,
        b.CustomerID,
        b.OrderID,
        f.ProductID,
        f.Description,
        b.TicketDate,
        f.Unit,
        f.Qty,
        f.UnitPrice,
        o.Description1 AS JobName,
        1 AS SourceRank,
        CAST(1 AS bit) AS IsFreight
    FROM freight_src AS f
    INNER JOIN base_src AS b
        ON f.TicketNo = b.TicketNo
       AND f.UniqueID = b.UniqueID
    INNER JOIN Slordnam AS o ON b.OrderID    = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    WHERE b.ExportStatus <> 'E'
      AND c.ArType = 'C'
),
e_dedup AS (
    SELECT *
         , ROW_NUMBER() OVER (
               PARTITION BY TicketNo, UniqueID, ProductID
               ORDER BY ItemNo
           ) AS rn
    FROM e_raw
),
e_seq AS (
    SELECT
        d.TicketNo,
        d.UniqueID,
        d.LocationID,
        d.JobNumber,
        d.CustomerID,
        d.OrderID,
        d.ProductID,
        d.Description,
        d.TicketDate,
        d.Unit,
        d.Qty,
        d.UnitPrice,
        d.JobName,
        d.SourceRank,
        d.IsFreight,
        ROW_NUMBER() OVER (
            PARTITION BY d.TicketNo, d.UniqueID
            ORDER BY 
                d.IsFreight DESC,      -- freight first for each ticket
                d.ProductID,
                d.ItemNo,
                d.Description
        ) AS OtherRowNum
    FROM e_dedup AS d
    WHERE d.rn = 1
),
final_rows AS (
    SELECT
        b.TicketNo,
        b.UniqueID,
        b.ItemNo,
        b.LocationID,
        b.JobNumber,
        b.CustomerID,
        b.OrderID,
        b.ProductID,
        b.Description,
        b.TicketDate,
        b.Unit,
        b.Qty,
        b.UnitPrice,
        b.JobName,
        b.SourceRank
    FROM base AS b

    UNION ALL

    SELECT
        e.TicketNo,
        e.UniqueID,
        (ISNULL(m.MaxBaseItemNo, 0) + e.OtherRowNum) AS ItemNo,
        e.LocationID,
        e.JobNumber,
        e.CustomerID,
        e.OrderID,
        e.ProductID,
        e.Description,
        e.TicketDate,
        e.Unit,
        e.Qty,
        e.UnitPrice,
        e.JobName,
        e.SourceRank
    FROM e_seq AS e
    JOIN base_max AS m
      ON m.TicketNo = e.TicketNo
     AND m.UniqueID = e.UniqueID
),
annotated AS (
    SELECT
        fr.TicketNo,
        fr.UniqueID,
        fr.ItemNo,
        fr.LocationID,
        fr.JobNumber,
        fr.CustomerID,
        fr.OrderID,
        fr.ProductID,
        fr.Description,
        fr.TicketDate,
        fr.Unit,
        fr.Qty,
        fr.UnitPrice,
        fr.JobName,
        fr.SourceRank,
        COALESCE(
            w.Ticket_AccountCode,
            t.Ticket_AccountCode
        ) AS Ticket_AccountCode,
        CASE
            WHEN w.TicketNo IS NOT NULL THEN w.OnHold
            ELSE t.OnHold
        END AS OnHold,
        COALESCE(
            CONVERT(datetime2(0), w.Ticket_DateTime),
            CONVERT(datetime2(0), t.Ticket_DateTime),
            CONVERT(datetime2(0), fr.TicketDate)
        ) AS TicketDateTime,
        CASE
            WHEN w.TicketNo IS NOT NULL THEN CAST(1 AS bit)
            ELSE CAST(0 AS bit)
        END AS IsWorkingRow
    FROM final_rows AS fr
    LEFT JOIN dbo.GRC_Intra_Ticket_AccountCode_Working AS w
        ON w.TicketNo = fr.TicketNo
       AND w.TicketUniqueID = fr.UniqueID
       AND w.TicketItemNo = fr.ItemNo
       AND w.ProductID = fr.ProductID
       AND w.LocationID = fr.LocationID
       AND w.OrderID = fr.OrderID
       AND CONVERT(date, w.Ticket_DateTime) = CONVERT(date, fr.TicketDate)
    LEFT JOIN dbo.GRC_Intra_Ticket_AccountCode_TEST AS t
        ON t.TicketNo = fr.TicketNo
       AND t.TicketUniqueID = fr.UniqueID
       AND t.TicketItemNo = fr.ItemNo
       AND t.ProductID = fr.ProductID
       AND t.LocationID = fr.LocationID
       AND t.OrderID = fr.OrderID
       AND CONVERT(date, t.Ticket_DateTime) = CONVERT(date, fr.TicketDate)
)
SELECT
    TicketNo,
    UniqueID,
    ItemNo,
    LocationID,
    JobNumber,
    CustomerID,
    OrderID,
    ProductID,
    Description,
    TicketDate,
    Unit,
    Qty,
    UnitPrice,
    JobName,
    Ticket_AccountCode AS TicketAccountCode,
    OnHold,
    IsWorkingRow,
    TicketDateTime
FROM annotated
ORDER BY
    TicketNo,
    TicketDateTime,
    UniqueID,
    ItemNo,
    SourceRank;
`;

async function getPool(): Promise<ConnectionPool> {
  if (pool) {
    return pool;
  }

  pool = await new sql.ConnectionPool(sqlConfig).connect();
  pool.on("error", () => {
    pool = null;
  });
  return pool;
}

export type TicketRecord = {
  TicketNo: string;
  UniqueID: string | number | null;
  ItemNo: string | number | null;
  LocationID: string | number | null;
  JobNumber: string | null;
  CustomerID: string | number | null;
  OrderID: string | number | null;
  ProductID: string | number | null;
  Description: string | null;
  TicketDate: Date | string | null;
  TicketDateTime: Date | string | null;
  Unit: string | null;
  Qty: number | string | null;
  UnitPrice: number | string | null;
  JobName: string | null;
  TicketAccountCode: string | null;
  OnHold: string | null;
  IsWorkingRow: boolean | number | null;
};

export type TicketAccountCodeInput = {
  TicketNo: number;
  TicketUniqueID: number;
  TicketItemNo: number;
  ProductID: string;
  LocationID: string;
  OrderID: string;
  TicketDateTime: Date;
  TicketAccountCode: string | null;
  OnHold?: string | null;
};

export async function fetchTickets(): Promise<TicketRecord[]> {
  const connection = await getPool();
  const results = await connection.request().query<TicketRecord>(TICKETS_QUERY);
  return results.recordset ?? [];
}

export type AccountCodeValidationResult = {
  code: string;
  isValid: boolean;
  taskDesc: string;
  acctDesc: string;
};

const ACCOUNT_CODE_TVP_TYPE = "dbo.AccountCodeValidationList";
const ACCOUNT_CODE_PROC = "dbo.GRC_Intra_ValidateAccountCodes";

const normalizeAccountCodeValue = (value: string): string =>
  value.trim().toUpperCase();

export async function validateAccountCodes(
  codes: string[]
): Promise<AccountCodeValidationResult[]> {
  const sanitized = Array.from(
    new Set(
      codes
        .map((code) => normalizeAccountCodeValue(code))
        .filter((code) => code.length > 0)
    )
  );

  if (sanitized.length === 0) {
    return [];
  }

  const table = new sql.Table(ACCOUNT_CODE_TVP_TYPE);
  table.create = false;
  table.columns.add("acct_code", sql.NVarChar(20), { nullable: false });
  sanitized.forEach((code) => {
    table.rows.add(code);
  });

  const connection = await getPool();
  const request = connection.request();
  request.input("codes", table);

  type RawValidationRow = {
    acct_code: string;
    isValid: boolean | number;
    taskcode_description: string;
    account_description: string;
  };

  const results = await request.execute<RawValidationRow>(ACCOUNT_CODE_PROC);
  const rows = results.recordset ?? [];

  return rows.map((row) => ({
    code: normalizeAccountCodeValue(row.acct_code ?? ""),
    isValid: row.isValid === true || row.isValid === 1,
    taskDesc: row.taskcode_description ?? "",
    acctDesc: row.account_description ?? "",
  }));
}

const resolveWindowsUser = (): string => {
  try {
    const details = os.userInfo();
    if (details?.username) {
      return details.username;
    }
  } catch {
    // intentionally ignore user info lookups failing
  }

  return (
    process.env.USERNAME || process.env.USER || process.env.LOGNAME || "unknown"
  );
};

export async function saveTicketAccountCodes(
  rows: TicketAccountCodeInput[]
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const connection = await getPool();
  const transaction = new sql.Transaction(connection);
  await transaction.begin();

  const now = new Date();
  const lastUpdatedBy = resolveWindowsUser();

  let processedCount = 0;

  try {
    for (const row of rows) {
      const request = new sql.Request(transaction);
      request.input("TicketNo", sql.Int, row.TicketNo);
      request.input("TicketUniqueID", sql.Int, row.TicketUniqueID);
      request.input("TicketItemNo", sql.Int, row.TicketItemNo);
      request.input("ProductID", sql.VarChar(25), row.ProductID);
      request.input("LocationID", sql.VarChar(25), row.LocationID);
      request.input("OrderID", sql.VarChar(25), row.OrderID);
      request.input("TicketDateTime", sql.DateTime, row.TicketDateTime);
      request.input(
        "TicketAccountCode",
        sql.NVarChar(20),
        row.TicketAccountCode
      );
      request.input("LastUpdatedDateTime", sql.DateTime, now);
      request.input("LastUpdatedByUser", sql.VarChar(40), lastUpdatedBy);
      request.input("OnHold", sql.Char(1), row.OnHold ?? null);

      await request.query(`
        UPDATE dbo.GRC_Intra_Ticket_AccountCode_Working
        SET Ticket_AccountCode = @TicketAccountCode,
            LastUpdatedDateTime = @LastUpdatedDateTime,
            LastUpdatedByUser = @LastUpdatedByUser,
            OnHold = @OnHold
        WHERE TicketNo = @TicketNo
          AND TicketUniqueID = @TicketUniqueID
          AND TicketItemNo = @TicketItemNo
          AND ProductID = @ProductID
          AND LocationID = @LocationID
          AND OrderID = @OrderID
          AND Ticket_DateTime = @TicketDateTime;

        IF @@ROWCOUNT = 0
        BEGIN
          INSERT INTO dbo.GRC_Intra_Ticket_AccountCode_Working (
            TicketNo,
            TicketUniqueID,
            TicketItemNo,
            ProductID,
            LocationID,
            OrderID,
            Ticket_DateTime,
            Ticket_AccountCode,
            LastUpdatedDateTime,
            LastUpdatedByUser,
            OnHold
          )
          VALUES (
            @TicketNo,
            @TicketUniqueID,
            @TicketItemNo,
            @ProductID,
            @LocationID,
            @OrderID,
            @TicketDateTime,
            @TicketAccountCode,
            @LastUpdatedDateTime,
            @LastUpdatedByUser,
            @OnHold
          );
        END
      `);

      processedCount += 1;
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {
      // ignore rollback failures
    });
    throw error;
  }

  try {
    const result = await connection
      .request()
      .execute(UPSERT_WORKING_TO_TEST_PROCEDURE);
    const savedCount = extractSavedRowCount(result);
    if (savedCount !== null) {
      return savedCount;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred.";
    throw new Error(
      `Unable to finalize ticket account code changes: ${message}`
    );
  }

  return processedCount;
}

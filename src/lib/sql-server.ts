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
    WHERE ExportStatus = 'X'
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
e_raw AS (
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
        1 AS SourceRank
    FROM other_src AS e
    INNER JOIN base_src AS b
        ON e.TicketNo = b.TicketNo
       AND e.UniqueID = b.UniqueID
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
        ROW_NUMBER() OVER (
            PARTITION BY d.TicketNo, d.UniqueID
            ORDER BY d.ProductID, d.ItemNo, d.Description
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
    JobName
FROM final_rows
ORDER BY
    TicketNo,
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
  Unit: string | null;
  Qty: number | string | null;
  UnitPrice: number | string | null;
  JobName: string | null;
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
    process.env.USERNAME ||
    process.env.USER ||
    process.env.LOGNAME ||
    "unknown"
  );
};

export async function saveTicketAccountCodes(
  rows: TicketAccountCodeInput[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const connection = await getPool();
  const transaction = new sql.Transaction(connection);
  await transaction.begin();

  const now = new Date();
  const lastUpdatedBy = resolveWindowsUser();

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
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {
      // ignore rollback failures
    });
    throw error;
  }
}

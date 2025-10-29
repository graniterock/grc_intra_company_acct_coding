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
WITH Tickets AS (
    /* --- 1) Current base tickets (Tkbatch) --- */
    SELECT
        b.TicketNo,
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
        0 AS SourceRank  -- base first
    FROM Tkbatch AS b
    INNER JOIN Slordnam AS o ON b.OrderID = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    WHERE b.ExportStatus <> 'E'
      AND c.ArType = 'C'

    UNION ALL

    /* --- 2) Historical base tickets (Tkhist1) --- */
    SELECT
        b.TicketNo,
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
        0 AS SourceRank  -- base first
    FROM Tkhist1 AS b
    INNER JOIN Slordnam AS o ON b.OrderID = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    --WHERE b.ExportStatus <> 'E'
    WHERE b.ExportStatus = 'X'
      AND c.ArType = 'C'

    UNION ALL

    /* --- 3) Current "other" lines (Tkeother) joined via Tkbatch --- */
    SELECT
        e.TicketNo,
        b.LocationID,
        o.Description2 AS JobNumber,
        b.CustomerID,
        b.OrderID,
        e.OtherChargeID AS ProductID,
        e.Description,       -- 'other' description
        b.TicketDate,        -- use base ticket date for ordering
        e.Unit,
        e.Qty,
        e.UnitPrice,
        o.Description1 AS JobName,
        1 AS SourceRank      -- other after base for same ticket
    FROM Tkeother AS e
    INNER JOIN Tkbatch  AS b ON e.TicketNo = b.TicketNo
    INNER JOIN Slordnam AS o ON b.OrderID   = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    WHERE b.ExportStatus <> 'E'
      AND c.ArType = 'C'

    UNION ALL

    /* --- 4) Historical "other" lines (Tkohist) joined via Tkhist1 --- */
    SELECT
        e.TicketNo,
        b.LocationID,
        o.Description2 AS JobNumber,
        b.CustomerID,
        b.OrderID,
        e.OtherChargeID AS ProductID,
        e.Description,       -- 'other' description
        b.TicketDate,        -- use base ticket date for ordering
        e.Unit,
        e.Qty,
        e.UnitPrice,
        o.Description1 AS JobName,
        1 AS SourceRank      -- other after base for same ticket
    FROM Tkohist AS e
    INNER JOIN Tkhist1 AS b ON e.TicketNo = b.TicketNo
    INNER JOIN Slordnam AS o ON b.OrderID   = o.OrderID
    INNER JOIN Slcust   AS c ON b.CustomerID = c.CustomerID
    --WHERE b.ExportStatus <> 'E'
    WHERE b.ExportStatus = 'X'
      AND c.ArType = 'C'
)
SELECT
    TicketNo,
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
FROM Tickets
ORDER BY
    TicketNo,
    TicketDate,
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

export async function fetchTickets(): Promise<TicketRecord[]> {
  const connection = await getPool();
  const results = await connection.request().query<TicketRecord>(TICKETS_QUERY);
  return results.recordset ?? [];
}

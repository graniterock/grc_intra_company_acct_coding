import { NextResponse } from "next/server";

import {
  saveTicketAccountCodes,
  type TicketAccountCodeInput,
} from "@/lib/sql-server";

type IncomingRow = {
  TicketNo: unknown;
  UniqueID: unknown;
  ItemNo: unknown;
  ProductID: unknown;
  LocationID: unknown;
  OrderID: unknown;
  TicketDate: unknown;
  TicketAccountCode?: unknown;
  OnHold?: unknown;
};

const parseNumber = (value: unknown, field: string): number => {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${field} is required.`);
  }

  const numeric =
    typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(numeric)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return numeric;
};

const parseString = (value: unknown, field: string): string => {
  if (value === null || value === undefined) {
    throw new Error(`${field} is required.`);
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
};

const parseOptionalCode = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 20);
};

const parseOnHold = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 1).toUpperCase();
};

const parseDate = (value: unknown, field: string): Date => {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${field} is required.`);
  }

  const candidate =
    value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`${field} must be a valid date.`);
  }

  return candidate;
};

const normalizeRow = (row: IncomingRow): TicketAccountCodeInput => {
  return {
    TicketNo: parseNumber(row.TicketNo, "TicketNo"),
    TicketUniqueID: parseNumber(row.UniqueID, "UniqueID"),
    TicketItemNo: parseNumber(row.ItemNo, "ItemNo"),
    ProductID: parseString(row.ProductID, "ProductID").slice(0, 25),
    LocationID: parseString(row.LocationID, "LocationID").slice(0, 25),
    OrderID: parseString(row.OrderID, "OrderID").slice(0, 25),
    TicketDateTime: parseDate(row.TicketDate, "TicketDate"),
    TicketAccountCode: parseOptionalCode(row.TicketAccountCode),
    OnHold: parseOnHold(row.OnHold),
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rows?: IncomingRow[];
    };

    if (!body?.rows || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { error: "Request must include an array of rows." },
        { status: 400 }
      );
    }

    const normalizedRows = body.rows.map(normalizeRow);

    await saveTicketAccountCodes(normalizedRows);

    return NextResponse.json({
      saved: normalizedRows.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save ticket data.";
    const status = error instanceof Error ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

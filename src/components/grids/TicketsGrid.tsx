"use client";

import { useMemo, useState } from "react";
import { DataGrid, Column, RenderEditCellProps } from "react-data-grid";
import type { FillEvent } from "react-data-grid";
import "react-data-grid/lib/styles.css";

/* Row shape for tickets */
type TicketRow = {
  TicketNo: string;
  BranchNo: string;
  OrderNumber: string;
  ProductCode: string;
  ProductDesc: string;
  TicketDate: string;
  UOM: string;
  QTY: number;
  UnitPrice: number;
  AcctCode: string;
};

/* Seed rows */
const initialRows: TicketRow[] = [
  {
    TicketNo: "T-10001",
    BranchNo: "10",
    OrderNumber: "O-50123",
    ProductCode: "AG57",
    ProductDesc: "Aggregate 5/7",
    TicketDate: "2025-10-10",
    UOM: "TON",
    QTY: 24.5,
    UnitPrice: 18.75,
    AcctCode: "140-555-001",
  },
  {
    TicketNo: "T-10002",
    BranchNo: "10",
    OrderNumber: "O-50123",
    ProductCode: "AG34",
    ProductDesc: "Aggregate 3/4",
    TicketDate: "2025-10-11",
    UOM: "TON",
    QTY: 18.0,
    UnitPrice: 17.25,
    AcctCode: "140-555-001",
  },
];

export default function TicketsGrid() {
  const [rows, setRows] = useState<TicketRow[]>(initialRows);

  const columns = useMemo<ReadonlyArray<Column<TicketRow>>>(
    () => [
      { key: "TicketNo", name: "Ticket #", width: 120, editable: true },
      { key: "BranchNo", name: "Branch", width: 100, editable: true },
      { key: "OrderNumber", name: "Order #", width: 140, editable: true },
      { key: "ProductCode", name: "Product", width: 120, editable: true },
      {
        key: "ProductDesc",
        name: "Description",
        editable: true,
        resizable: true,
      },
      { key: "TicketDate", name: "Date", width: 130, editable: true },
      { key: "UOM", name: "UOM", width: 90, editable: true },
      {
        key: "QTY",
        name: "Qty",
        width: 100,
        editable: true,
        renderEditCell: NumberEditor<TicketRow>,
      },
      {
        key: "UnitPrice",
        name: "Unit Price",
        width: 120,
        editable: true,
        renderEditCell: NumberEditor<TicketRow>,
      },
      { key: "AcctCode", name: "Acct Code", width: 160, editable: true },
    ],
    []
  );

  return (
    <div style={{ height: 500 }}>
      <DataGrid<TicketRow>
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        rowKeyGetter={(r: TicketRow) => r.TicketNo}
        /* Drag-to-fill (TS-safe cast of RDG FillEvent) */
        onFill={(event: FillEvent<TicketRow>) => {
          const columnKey = event.columnKey as keyof TicketRow;
          return {
            ...event.targetRow,
            [columnKey]: event.sourceRow[columnKey],
          };
        }}
      />
    </div>
  );
}

/** Simple numeric editor: keeps prior value if input is NaN */
function NumberEditor<R extends Record<string, unknown>>({
  row,
  column,
  onRowChange,
}: RenderEditCellProps<R>) {
  const key = column.key as keyof R;
  const val = row[key] as unknown as string | number | undefined;

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    onRowChange(
      { ...row, [key]: Number.isFinite(n) ? (n as any) : (val as any) },
      true
    );
  };

  return (
    <input
      autoFocus
      type="number"
      value={val ?? ""}
      onChange={(e) => commit(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        padding: "0 8px",
      }}
    />
  );
}

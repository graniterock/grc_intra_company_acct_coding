"use client";

import { useMemo, useState } from "react";
import { DataGrid, Column } from "react-data-grid";
import type { FillEvent } from "react-data-grid";
import "react-data-grid/lib/styles.css";

import type { OrderRow } from "../../types/grids";

/* Seed rows */
const initialRows: OrderRow[] = [
  {
    OrderNumber: "O-70001",
    ProductCode: "AG57",
    ProductDesc: "Aggregate 5/7",
    StartDate: "2025-10-01",
    EndDate: "2025-10-31",
    OrderAcctCode: "140-555-010",
    FreightCodeByTon_AA: "AA-100",
    ERF_AcctCode: "ERF-200",
    MTX_AcctCode: "MTX-300",
    AcctCode: "140-555-001",
    PW_AcctCode: "PW-400",
    LAS_AcctCode: "LAS-500",
    FS_AcctCode: "FS-600",
  },
  {
    OrderNumber: "O-70002",
    ProductCode: "AG34",
    ProductDesc: "Aggregate 3/4",
    StartDate: "2025-10-05",
    EndDate: "2025-11-05",
    OrderAcctCode: "140-555-020",
    FreightCodeByTon_AA: "AA-110",
    ERF_AcctCode: "ERF-210",
    MTX_AcctCode: "MTX-310",
    AcctCode: "140-555-002",
    PW_AcctCode: "PW-410",
    LAS_AcctCode: "LAS-510",
    FS_AcctCode: "FS-610",
  },
];

export default function OrdersGrid() {
  const [rows, setRows] = useState<OrderRow[]>(initialRows);

  const columns = useMemo<ReadonlyArray<Column<OrderRow>>>(
    () => [
      { key: "OrderNumber", name: "Order #", width: 150, editable: true },
      { key: "ProductCode", name: "Product", width: 140, editable: true },
      {
        key: "ProductDesc",
        name: "Description",
        editable: true,
        resizable: true,
      },
      { key: "StartDate", name: "Start", width: 130, editable: true },
      { key: "EndDate", name: "End", width: 130, editable: true },
      {
        key: "OrderAcctCode",
        name: "Order AcctCode",
        width: 160,
        editable: true,
      },
      {
        key: "FreightCodeByTon_AA",
        name: "Freight Code By Ton (AA)",
        width: 220,
        editable: true,
      },
      { key: "ERF_AcctCode", name: "ERF AcctCode", width: 150, editable: true },
      { key: "MTX_AcctCode", name: "MTX AcctCode", width: 150, editable: true },
      { key: "AcctCode", name: "Acct Code", width: 140, editable: true },
      { key: "PW_AcctCode", name: "PW AcctCode", width: 150, editable: true },
      { key: "LAS_AcctCode", name: "LAS AcctCode", width: 150, editable: true },
      { key: "FS_AcctCode", name: "FS AcctCode", width: 150, editable: true },
    ],
    []
  );

  return (
    <div style={{ height: 500 }}>
      {/* Note the 3rd generic: <OrderRow, unknown, string> */}
      <DataGrid<OrderRow, unknown, string>
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        rowKeyGetter={(r: OrderRow) => r.OrderNumber}
        /* Drag-to-fill - produce a new row for the target */
        onFill={(event: FillEvent<OrderRow>) => {
          const columnKey = event.columnKey as keyof OrderRow;
          return {
            ...event.targetRow,
            [columnKey]: event.sourceRow[columnKey],
          };
        }}
      />
    </div>
  );
}

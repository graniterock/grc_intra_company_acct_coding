"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridOptions } from "ag-grid-community";
import type { TicketRow } from "../../types/grids";

/* ✅ Add these two lines */
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

/* Required AG Grid styles */
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

/* Mock rows for the first pass */
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
  const [rowData, setRowData] = useState<TicketRow[]>(initialRows);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      editable: true,
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
    }),
    []
  );

  const columnDefs = useMemo<ColDef<TicketRow>[]>(
    () => [
      { field: "TicketNo", headerName: "TicketNo", width: 130 },
      { field: "BranchNo", headerName: "BranchNo", width: 110 },
      { field: "OrderNumber", headerName: "OrderNumber", width: 140 },
      { field: "ProductCode", headerName: "ProductCode", width: 140 },
      {
        field: "ProductDesc",
        headerName: "ProductDesc",
        flex: 1,
        minWidth: 160,
      },
      { field: "TicketDate", headerName: "TicketDate", width: 130 },
      { field: "UOM", headerName: "UOM", width: 90 },
      {
        field: "QTY",
        headerName: "QTY",
        width: 100,
        valueParser: numberParser,
      },
      {
        field: "UnitPrice",
        headerName: "UnitPrice",
        width: 120,
        valueParser: numberParser,
      },
      { field: "AcctCode", headerName: "AcctCode", width: 160 },
    ],
    []
  );

  const gridOptions: GridOptions<TicketRow> = {
    defaultColDef,
    columnDefs,
    rowData,
    rowSelection: "multiple",
    enableRangeSelection: true,
    enableFillHandle: true, // drag-to-fill like Excel
    animateRows: true,
    onCellValueChanged: (e) => {
      setRowData((prev) =>
        prev.map((r, idx) =>
          idx === e.rowIndex ? { ...r, [e.colDef.field!]: e.newValue } : r
        )
      );
    },
  };

  return (
    <div className="ag-theme-quartz" style={{ height: 500, width: "100%" }}>
      <AgGridReact<TicketRow> gridOptions={gridOptions} />
    </div>
  );
}

function numberParser(params: any) {
  const v = parseFloat(params.newValue);
  return Number.isFinite(v) ? v : params.oldValue;
}

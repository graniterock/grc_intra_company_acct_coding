"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridOptions, ValueParserParams } from "ag-grid-community";
import type { TicketRow } from "../../types/grids";

/* v33+/v34 module registration: use the “All…” bundles */
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

/* AG Grid CSS (Quartz theme) */
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

/* Mock rows */
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
      { field: "TicketNo", width: 130 },
      { field: "BranchNo", width: 110 },
      { field: "OrderNumber", width: 140 },
      { field: "ProductCode", width: 140 },
      { field: "ProductDesc", flex: 1, minWidth: 160 },
      { field: "TicketDate", width: 130 },
      { field: "UOM", width: 90 },
      { field: "QTY", width: 100, valueParser: numberParser },
      { field: "UnitPrice", width: 120, valueParser: numberParser },
      { field: "AcctCode", width: 160 },
    ],
    []
  );

  const gridOptions: GridOptions<TicketRow> = {
    defaultColDef,
    columnDefs,
    rowData,
    rowSelection: "multiple",
    enableRangeSelection: true,
    enableFillHandle: true,

    animateRows: true,

    onCellValueChanged: (e) => {
      if (!e.colDef.field) return;
      setRowData((prev) =>
        prev.map((r, idx) =>
          idx === e.rowIndex ? { ...r, [e.colDef.field!]: e.newValue } : r
        )
      );
    },
  };

  return (
    <div className="ag-theme-quartz" style={{ height: 500, width: "100%" }}>
      {/* For legacy CSS themes in v34+ you can pass theme="legacy".
          If your preview renders fine without it, you can drop the prop. */}
      <AgGridReact<TicketRow> theme="legacy" gridOptions={gridOptions} />
    </div>
  );
}

function numberParser(params: ValueParserParams<TicketRow>) {
  const v = parseFloat(String(params.newValue));
  return Number.isFinite(v) ? v : params.oldValue;
}

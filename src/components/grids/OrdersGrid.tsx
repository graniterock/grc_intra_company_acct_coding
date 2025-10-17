"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridOptions } from "ag-grid-community";
import type { OrderRow } from "../../types/grids";

/* v33+/v34: register bundled modules once */
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

/* AG Grid CSS */
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

/* Mock rows */
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
  const [rowData, setRowData] = useState<OrderRow[]>(initialRows);

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

  const columnDefs = useMemo<ColDef<OrderRow>[]>(
    () => [
      { field: "OrderNumber", headerName: "Order Number", width: 150 },
      { field: "ProductCode", width: 140 },
      { field: "ProductDesc", flex: 1, minWidth: 160 },
      { field: "StartDate", width: 130 },
      { field: "EndDate", width: 130 },
      { field: "OrderAcctCode", headerName: "Order AcctCode", width: 160 },
      {
        field: "FreightCodeByTon_AA",
        headerName: "Freight Code By Ton (AA)",
        width: 220,
      },
      { field: "ERF_AcctCode", headerName: "ERF AcctCode", width: 150 },
      { field: "MTX_AcctCode", headerName: "MTX AcctCode", width: 150 },
      { field: "AcctCode", width: 140 },
      { field: "PW_AcctCode", headerName: "PW AcctCode", width: 150 },
      { field: "LAS_AcctCode", headerName: "LAS AcctCode", width: 150 },
      { field: "FS_AcctCode", headerName: "FS AcctCode", width: 150 },
    ],
    []
  );

  const gridOptions: GridOptions<OrderRow> = {
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
      <AgGridReact<OrderRow> theme="legacy" gridOptions={gridOptions} />
    </div>
  );
}

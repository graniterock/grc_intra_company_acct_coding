"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DataGrid, Column, RenderEditCellProps } from "react-data-grid";
import type { FillEvent, RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";

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

type TicketsGridProps = {
  height?: number | string;
};

export default function TicketsGrid({ height = 500 }: TicketsGridProps) {
  const [rows, setRows] = useState<TicketRow[]>(initialRows);
  const [filters, setFilters] = useState<Partial<Record<keyof TicketRow, string>>>({});

  const baseColumns = useMemo<ReadonlyArray<Column<TicketRow>>>(
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
      { key: "TicketDate", name: "Ticket Date", width: 130, editable: true },
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

  const dateColumns = useMemo(() => new Set<keyof TicketRow>(["TicketDate"]), []);
  const numericColumns = useMemo(
    () => new Set<keyof TicketRow>(["QTY", "UnitPrice"]),
    []
  );

  const handleFilterChange = useCallback(
    (key: keyof TicketRow, value: string) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (value) {
          next[key] = value;
        } else {
          delete next[key];
        }
        return next;
      });
    },
    []
  );

  const columns = useMemo(() => {
    return baseColumns.map((column) => {
      const columnKey = column.key as keyof TicketRow;
      const inputType: FilterInputType = dateColumns.has(columnKey)
        ? "date"
        : numericColumns.has(columnKey)
        ? "number"
        : "text";
      return {
        ...column,
        renderHeaderCell: () => (
          <HeaderFilter
            label={String(column.name)}
            value={filters[columnKey] ?? ""}
            type={inputType}
            onChange={(value) => handleFilterChange(columnKey, value)}
          />
        ),
      };
    });
  }, [baseColumns, dateColumns, numericColumns, filters, handleFilterChange]);

  const resolvedHeight =
    typeof height === "number" ? `${height}px` : height;

  const gridStyle: CSSProperties = {
    height: "100%",
    width: "100%",
    "--rdg-header-background-color": "var(--gr-pistachio)",
    "--rdg-header-draggable-background-color": "var(--gr-pistachio)",
    "--rdg-border-color": "color-mix(in srgb, var(--gr-grey-5) 45%, white)",
  } as CSSProperties;

  const filteredRows = useMemo(() => {
    if (Object.keys(filters).length === 0) return rows;
    return rows.filter((row) =>
      (Object.entries(filters) as Array<[keyof TicketRow, string]>).every(
        ([key, filterValue]) => {
          if (!filterValue) return true;
          const cellValue = row[key];
          if (cellValue === undefined || cellValue === null) return false;

          if (dateColumns.has(key)) {
            return String(cellValue) === filterValue;
          }

          const candidate = String(cellValue).toLowerCase();
          return candidate.includes(filterValue.toLowerCase());
        }
      )
    );
  }, [rows, filters, dateColumns]);

  const rowKeyGetter = useCallback((row: TicketRow) => row.TicketNo, []);

  const handleRowsChange = useCallback(
    (updatedRows: TicketRow[], data: RowsChangeData<TicketRow>) => {
      const changedIndexes =
        data.indexes && data.indexes.length > 0
          ? data.indexes
          : updatedRows.map((_, idx) => idx);
      if (changedIndexes.length === 0) return;
      setRows((prevRows) => {
        const updatedMap = new Map(prevRows.map((row) => [rowKeyGetter(row), row]));

        changedIndexes.forEach((idx) => {
          const updatedRow = updatedRows[idx];
          if (updatedRow) {
            updatedMap.set(rowKeyGetter(updatedRow), updatedRow);
          }
        });

        return prevRows.map(
          (row) => updatedMap.get(rowKeyGetter(row)) ?? row
        );
      });
    },
    [rowKeyGetter]
  );

  return (
    <div className="w-full" style={{ height: resolvedHeight, minHeight: 400 }}>
      <DataGrid<TicketRow>
        columns={columns}
        rows={filteredRows}
        onRowsChange={handleRowsChange}
        rowKeyGetter={rowKeyGetter}
        /* Drag-to-fill (TS-safe cast of RDG FillEvent) */
        onFill={(event: FillEvent<TicketRow>) => {
          const columnKey = event.columnKey as keyof TicketRow;
          return {
            ...event.targetRow,
            [columnKey]: event.sourceRow[columnKey],
          };
        }}
        headerRowHeight={64}
        style={gridStyle}
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
    const n = Number.parseFloat(raw);
    const fallbackValue = row[key] as R[typeof key];
    const nextValue = Number.isFinite(n)
      ? ((n as unknown) as R[typeof key])
      : fallbackValue;

    onRowChange(
      {
        ...row,
        [key]: nextValue,
      },
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

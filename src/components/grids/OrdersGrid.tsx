"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DataGrid, Column } from "react-data-grid";
import type { FillEvent, RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";

import type { OrderRow } from "../../types/grids";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";
import { DraggableCell, type DragLocation } from "./DraggableCell";
import { DateEditor } from "./DateEditor";

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
  {
    OrderNumber: "O-70003",
    ProductCode: "RMX1",
    ProductDesc: "Ready Mix 4000psi",
    StartDate: "2025-09-20",
    EndDate: "2025-12-20",
    OrderAcctCode: "140-575-015",
    FreightCodeByTon_AA: "AA-205",
    ERF_AcctCode: "ERF-310",
    MTX_AcctCode: "MTX-410",
    AcctCode: "150-300-010",
    PW_AcctCode: "PW-515",
    LAS_AcctCode: "LAS-615",
    FS_AcctCode: "FS-715",
  },
  {
    OrderNumber: "O-70004",
    ProductCode: "ASPH",
    ProductDesc: "Hot Mix Asphalt",
    StartDate: "2025-10-15",
    EndDate: "2026-01-15",
    OrderAcctCode: "140-590-030",
    FreightCodeByTon_AA: "AA-240",
    ERF_AcctCode: "ERF-420",
    MTX_AcctCode: "MTX-520",
    AcctCode: "160-410-022",
    PW_AcctCode: "PW-620",
    LAS_AcctCode: "LAS-720",
    FS_AcctCode: "FS-820",
  },
];

type OrdersGridProps = {
  height?: number | string;
};

export default function OrdersGrid({ height = 500 }: OrdersGridProps) {
  const [rows, setRows] = useState<OrderRow[]>(initialRows);
  const [filters, setFilters] = useState<Partial<Record<keyof OrderRow, string>>>({});

  const baseColumns = useMemo<ReadonlyArray<Column<OrderRow>>>(
    () => [
      { key: "OrderNumber", name: "Order #", minWidth: 140, editable: true },
      { key: "ProductCode", name: "Product", minWidth: 140, editable: true },
      {
        key: "ProductDesc",
        name: "Description",
        editable: true,
        minWidth: 240,
      },
      {
        key: "StartDate",
        name: "Start Date",
        minWidth: 150,
        editable: true,
        renderEditCell: DateEditor<OrderRow>,
      },
      {
        key: "EndDate",
        name: "End Date",
        minWidth: 150,
        editable: true,
        renderEditCell: DateEditor<OrderRow>,
      },
      {
        key: "OrderAcctCode",
        name: "Order AcctCode",
        minWidth: 200,
        editable: true,
      },
      {
        key: "FreightCodeByTon_AA",
        name: "Freight Code By Ton (AA)",
        minWidth: 220,
        editable: true,
      },
      {
        key: "ERF_AcctCode",
        name: "ERF AcctCode",
        minWidth: 170,
        editable: true,
      },
      {
        key: "MTX_AcctCode",
        name: "MTX AcctCode",
        minWidth: 170,
        editable: true,
      },
      { key: "AcctCode", name: "Acct Code", minWidth: 160, editable: true },
      {
        key: "PW_AcctCode",
        name: "PW AcctCode",
        minWidth: 170,
        editable: true,
      },
      {
        key: "LAS_AcctCode",
        name: "LAS AcctCode",
        minWidth: 170,
        editable: true,
      },
      {
        key: "FS_AcctCode",
        name: "FS AcctCode",
        minWidth: 170,
        editable: true,
      },
    ],
    []
  );

  const dateColumns = useMemo(
    () => new Set<keyof OrderRow>(["StartDate", "EndDate"]),
    []
  );

  const handleFilterChange = useCallback(
    (key: keyof OrderRow, value: string) => {
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

  const rowKeyGetter = useCallback((row: OrderRow) => row.OrderNumber, []);

  const columnKeys = useMemo(
    () => baseColumns.map((column) => String(column.key)),
    [baseColumns]
  );

  const handleCellValueDrop = useCallback(
    (source: DragLocation, target: DragLocation) => {
      setRows((prevRows) => {
        const sourceIndex = prevRows.findIndex(
          (row) => rowKeyGetter(row) === source.rowKey
        );
        const targetIndex = prevRows.findIndex(
          (row) => rowKeyGetter(row) === target.rowKey
        );

        if (sourceIndex === -1 || targetIndex === -1) {
          return prevRows;
        }

        const sourceRow = prevRows[sourceIndex];
        const sourceKey = source.columnKey as keyof OrderRow;
        const sourceValue = sourceRow[sourceKey];

        if (sourceValue == null) {
          return prevRows;
        }

        const normalizedValue = String(sourceValue);

        const startRow = Math.min(sourceIndex, targetIndex);
        const endRow = Math.max(sourceIndex, targetIndex);
        const startColumn = Math.min(source.columnIndex, target.columnIndex);
        const endColumn = Math.max(source.columnIndex, target.columnIndex);
        const columnsToUpdate = columnKeys.slice(startColumn, endColumn + 1);

        let didChange = false;

        const nextRows = prevRows.map((row, rowIndex) => {
          if (rowIndex < startRow || rowIndex > endRow) {
            return row;
          }

          let nextRow = row;

          columnsToUpdate.forEach((columnKey) => {
            const typedKey = columnKey as keyof OrderRow;
            const existingValue = row[typedKey];
            const coercedValue = normalizedValue;

            if (coercedValue !== existingValue) {
              if (nextRow === row) {
                nextRow = { ...row };
              }
              nextRow[typedKey] = coercedValue;
              didChange = true;
            }
          });

          return nextRow;
        });

        if (!didChange) {
          return prevRows;
        }

        return nextRows;
      });
    },
    [columnKeys, rowKeyGetter]
  );

  const columns = useMemo(() => {
    return baseColumns.map((column, columnIndex) => {
      const columnKey = column.key as keyof OrderRow;
      const inputType: FilterInputType = dateColumns.has(columnKey) ? "date" : "text";
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
        renderCell: (cellProps) => (
          <DraggableCell<OrderRow>
            {...cellProps}
            columnIndex={columnIndex}
            rowKey={rowKeyGetter(cellProps.row)}
            onDropValue={handleCellValueDrop}
          />
        ),
      };
    });
  }, [
    baseColumns,
    dateColumns,
    filters,
    handleCellValueDrop,
    handleFilterChange,
    rowKeyGetter,
  ]);

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
      (Object.entries(filters) as Array<[keyof OrderRow, string]>).every(
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

  const handleRowsChange = useCallback(
    (updatedRows: OrderRow[], data: RowsChangeData<OrderRow>) => {
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
    <div
      className="w-full"
      style={{ height: resolvedHeight, minHeight: 400 }}
    >
      {/* Note the 3rd generic: <OrderRow, unknown, string> */}
      <DataGrid<OrderRow, unknown, string>
        columns={columns}
        rows={filteredRows}
        onRowsChange={handleRowsChange}
        rowKeyGetter={rowKeyGetter}
        defaultColumnOptions={{ resizable: true }}
        /* Drag-to-fill - produce a new row for the target */
        onFill={(event: FillEvent<OrderRow>) => {
          const columnKey = event.columnKey as keyof OrderRow;
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

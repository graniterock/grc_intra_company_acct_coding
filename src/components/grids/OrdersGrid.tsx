"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DataGrid, type Column, type SortColumn } from "react-data-grid";
import type { FillEvent, RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";

import type { OrderRow } from "../../types/grids";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";
import { DraggableCell, type DragLocation } from "./DraggableCell";
import { TextEditor } from "./TextEditor";

/* Seed rows */
const initialRows: OrderRow[] = [
  {
    OrderNumber: "O-70001",
    CustomerNumber: "C-40001",
    JobNumber: "J-80001",
    BranchNo: "10",
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
    CustomerNumber: "C-40002",
    JobNumber: "J-80002",
    BranchNo: "10",
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
    CustomerNumber: "C-41001",
    JobNumber: "J-81005",
    BranchNo: "20",
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
    CustomerNumber: "C-42015",
    JobNumber: "J-82015",
    BranchNo: "30",
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
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);

  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    []
  );

  const baseColumns = useMemo<ReadonlyArray<Column<OrderRow>>>(
    () => [
      { key: "OrderNumber", name: "Order #", minWidth: 140 },
      { key: "CustomerNumber", name: "Customer #", minWidth: 160 },
      { key: "JobNumber", name: "Job #", minWidth: 140 },
      { key: "BranchNo", name: "Branch", minWidth: 100 },
      { key: "ProductCode", name: "Product", minWidth: 140 },
      {
        key: "ProductDesc",
        name: "Description",
        minWidth: 240,
      },
      {
        key: "StartDate",
        name: "Start Date",
        minWidth: 150,
      },
      {
        key: "EndDate",
        name: "End Date",
        minWidth: 150,
      },
      {
        key: "OrderAcctCode",
        name: "Order AcctCode",
        minWidth: 200,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
      {
        key: "FreightCodeByTon_AA",
        name: "Freight Code By Ton (AA)",
        minWidth: 220,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
      {
        key: "ERF_AcctCode",
        name: "ERF AcctCode",
        minWidth: 170,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
      {
        key: "MTX_AcctCode",
        name: "MTX AcctCode",
        minWidth: 170,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
      {
        key: "PW_AcctCode",
        name: "PW AcctCode",
        minWidth: 170,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
      {
        key: "LAS_AcctCode",
        name: "LAS AcctCode",
        minWidth: 170,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
      {
        key: "FS_AcctCode",
        name: "FS AcctCode",
        minWidth: 170,
        editable: true,
        renderEditCell: TextEditor<OrderRow>,
      },
    ],
    []
  );

  const dateColumns = useMemo(
    () => new Set<keyof OrderRow>(["StartDate", "EndDate"]),
    []
  );

  const columnOptions = useMemo(() => {
    const filterEntries = (Object.entries(filters) as Array<[keyof OrderRow, string]>).filter(
      ([, value]) => Boolean(value)
    );

    const matchesFilter = (
      row: OrderRow,
      key: keyof OrderRow,
      filterValue: string
    ): boolean => {
      const cellValue = row[key];
      if (cellValue === undefined || cellValue === null) return false;

      if (dateColumns.has(key)) {
        return String(cellValue) === filterValue;
      }

      const candidate = String(cellValue).toLowerCase();
      return candidate.includes(filterValue.toLowerCase());
    };

    const optionsMap = new Map<keyof OrderRow, string[]>();

    baseColumns.forEach((column) => {
      const columnKey = column.key as keyof OrderRow;
      const otherFilters = filterEntries.filter(([key]) => key !== columnKey);
      const relevantRows =
        otherFilters.length === 0
          ? rows
          : rows.filter((row) =>
              otherFilters.every(([key, filterValue]) => matchesFilter(row, key, filterValue))
            );

      const valueSet = new Set<string>();
      relevantRows.forEach((row) => {
        const value = row[columnKey];
        if (value === undefined || value === null || value === "") return;
        valueSet.add(String(value));
      });

      optionsMap.set(columnKey, Array.from(valueSet).sort(collator.compare));
    });

    return optionsMap;
  }, [rows, filters, dateColumns, collator, baseColumns]);

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

  const sortedRows = useMemo(() => {
    if (sortColumns.length === 0) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      for (const sort of sortColumns) {
        const columnKey = sort.columnKey as keyof OrderRow;
        const directionMultiplier = sort.direction === "ASC" ? 1 : -1;
        const aValue = a[columnKey];
        const bValue = b[columnKey];

        if (aValue === bValue) continue;

        if (aValue === null || aValue === undefined) {
          return -1 * directionMultiplier;
        }
        if (bValue === null || bValue === undefined) {
          return 1 * directionMultiplier;
        }

        let comparison: number;
        if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = collator.compare(String(aValue), String(bValue));
        }

        if (comparison !== 0) {
          return comparison * directionMultiplier;
        }
      }
      return 0;
    });
  }, [filteredRows, sortColumns, collator]);

  const visibleRowKeys = useMemo(
    () => sortedRows.map((row) => rowKeyGetter(row)),
    [sortedRows, rowKeyGetter]
  );

  const toggleSortColumn = useCallback(
    (columnKey: keyof OrderRow, shiftKey: boolean) => {
      setSortColumns((prev) => {
        const current = prev.find((entry) => entry.columnKey === columnKey);
        const currentDirection = current?.direction;
        const nextDirection =
          currentDirection === "ASC" ? "DESC" : currentDirection === "DESC" ? undefined : "ASC";

        if (shiftKey) {
          const remaining = prev.filter((entry) => entry.columnKey !== columnKey);
          if (!nextDirection) {
            return remaining;
          }
          return [...remaining, { columnKey, direction: nextDirection }];
        }

        if (!nextDirection) {
          return [];
        }

        return [{ columnKey, direction: nextDirection }];
      });
    },
    []
  );

  const editableColumns = useMemo(
    () =>
      new Set<keyof OrderRow>([
        "OrderAcctCode",
        "FreightCodeByTon_AA",
        "ERF_AcctCode",
        "MTX_AcctCode",
        "PW_AcctCode",
        "LAS_AcctCode",
        "FS_AcctCode",
      ]),
    []
  );

  const handleCellValueDrop = useCallback(
    (source: DragLocation, target: DragLocation) => {
      if (
        source.columnKey !== target.columnKey ||
        !editableColumns.has(source.columnKey as keyof OrderRow)
      ) {
        return;
      }

      setRows((prevRows) => {
        const sourceIndex = prevRows.findIndex(
          (row) => rowKeyGetter(row) === source.rowKey
        );
        const targetIndex = prevRows.findIndex(
          (row) => rowKeyGetter(row) === target.rowKey
        );

        const sourceVisibleIndex = visibleRowKeys.indexOf(source.rowKey);
        const targetVisibleIndex = visibleRowKeys.indexOf(target.rowKey);

        if (
          sourceIndex === -1 ||
          targetIndex === -1 ||
          sourceVisibleIndex === -1 ||
          targetVisibleIndex === -1
        ) {
          return prevRows;
        }

        const columnKey = source.columnKey as keyof OrderRow;
        const sourceValue = prevRows[sourceIndex]?.[columnKey];

        if (sourceValue == null) {
          return prevRows;
        }

        const normalizedValue = String(sourceValue);

        const startVisible = Math.min(sourceVisibleIndex, targetVisibleIndex);
        const endVisible = Math.max(sourceVisibleIndex, targetVisibleIndex);
        const keysToUpdate = new Set(
          visibleRowKeys.slice(startVisible, endVisible + 1)
        );

        let didChange = false;

        const nextRows = prevRows.map((row) => {
          const key = rowKeyGetter(row);
          if (!keysToUpdate.has(key)) {
            return row;
          }

          if (row[columnKey] === normalizedValue) {
            return row;
          }

          didChange = true;
          return {
            ...row,
            [columnKey]: normalizedValue,
          };
        });

        if (!didChange) {
          return prevRows;
        }

        return nextRows;
      });
    },
    [editableColumns, rowKeyGetter, visibleRowKeys]
  );

  const columns = useMemo(() => {
    return baseColumns.map((column, columnIndex) => {
      const columnKey = column.key as keyof OrderRow;
      const inputType: FilterInputType = dateColumns.has(columnKey) ? "date" : "text";
      const sortEntry = sortColumns.find((entry) => entry.columnKey === columnKey);
      return {
        ...column,
        sortable: false,
        renderHeaderCell: () => (
          <HeaderFilter
            label={String(column.name)}
            value={filters[columnKey] ?? ""}
            type={inputType}
            options={columnOptions.get(columnKey)}
            onChange={(value) => handleFilterChange(columnKey, value)}
            onLabelClick={(event) => toggleSortColumn(columnKey, event.shiftKey)}
            sortDirection={sortEntry?.direction ?? null}
          />
        ),
        renderCell: (cellProps) => (
          <DraggableCell<OrderRow>
            {...cellProps}
            columnIndex={columnIndex}
            rowKey={rowKeyGetter(cellProps.row)}
            onDropValue={handleCellValueDrop}
            canDrag={editableColumns.has(columnKey)}
            canDrop={editableColumns.has(columnKey)}
          />
        ),
      };
    });
  }, [
    baseColumns,
    dateColumns,
    columnOptions,
    editableColumns,
    filters,
    handleCellValueDrop,
    handleFilterChange,
    rowKeyGetter,
    sortColumns,
    toggleSortColumn,
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
        rows={sortedRows}
        onRowsChange={handleRowsChange}
        rowKeyGetter={rowKeyGetter}
        sortColumns={sortColumns}
        onSortColumnsChange={setSortColumns}
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

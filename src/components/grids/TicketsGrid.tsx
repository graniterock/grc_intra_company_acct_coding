"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DataGrid, Column } from "react-data-grid";
import type { FillEvent, RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";
import { DraggableCell, type DragLocation } from "./DraggableCell";
import { TextEditor } from "./TextEditor";

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
  {
    TicketNo: "T-10003",
    BranchNo: "20",
    OrderNumber: "O-60111",
    ProductCode: "RMX1",
    ProductDesc: "Ready Mix 4000psi",
    TicketDate: "2025-10-12",
    UOM: "CY",
    QTY: 12.5,
    UnitPrice: 145.0,
    AcctCode: "150-120-004",
  },
  {
    TicketNo: "T-10004",
    BranchNo: "30",
    OrderNumber: "O-70991",
    ProductCode: "ASPH",
    ProductDesc: "Hot Mix Asphalt",
    TicketDate: "2025-10-13",
    UOM: "TON",
    QTY: 32.75,
    UnitPrice: 82.4,
    AcctCode: "160-220-018",
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
      { key: "TicketNo", name: "Ticket #", width: 120 },
      { key: "BranchNo", name: "Branch", width: 100 },
      { key: "OrderNumber", name: "Order #", width: 140 },
      { key: "ProductCode", name: "Product", width: 120 },
      {
        key: "ProductDesc",
        name: "Description",
        resizable: true,
        width: 240,
        minWidth: 240,
      },
      {
        key: "TicketDate",
        name: "Ticket Date",
        width: 130,
      },
      { key: "UOM", name: "UOM", width: 90 },
      {
        key: "QTY",
        name: "Qty",
        width: 100,
      },
      {
        key: "UnitPrice",
        name: "Unit Price",
        width: 120,
      },
      {
        key: "AcctCode",
        name: "Acct Code",
        width: 160,
        editable: true,
        renderEditCell: TextEditor<TicketRow>,
      },
    ],
    []
  );

  const dateColumns = useMemo(() => new Set<keyof TicketRow>(["TicketDate"]), []);
  const numericColumns = useMemo(
    () => new Set<keyof TicketRow>(["QTY", "UnitPrice"]),
    []
  );

  const columnOptions = useMemo(() => {
    const optionSets = new Map<keyof TicketRow, Set<string>>();

    rows.forEach((row) => {
      (Object.keys(row) as Array<keyof TicketRow>).forEach((key) => {
        const cellValue = row[key];
        if (cellValue === undefined || cellValue === null || cellValue === "") {
          return;
        }
        const normalized = String(cellValue);
        if (!optionSets.has(key)) {
          optionSets.set(key, new Set());
        }
        optionSets.get(key)!.add(normalized);
      });
    });

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const optionsMap = new Map<keyof TicketRow, string[]>();

    optionSets.forEach((set, key) => {
      optionsMap.set(key, Array.from(set).sort(collator.compare));
    });

    return optionsMap;
  }, [rows]);

  const rowKeyGetter = useCallback((row: TicketRow) => row.TicketNo, []);

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

  const visibleRowKeys = useMemo(
    () => filteredRows.map((row) => rowKeyGetter(row)),
    [filteredRows, rowKeyGetter]
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

  const handleCellValueDrop = useCallback(
    (source: DragLocation, target: DragLocation) => {
      if (source.columnKey !== "AcctCode" || target.columnKey !== "AcctCode") {
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

        const sourceValue = prevRows[sourceIndex]?.AcctCode ?? "";
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

          if (row.AcctCode === sourceValue) {
            return row;
          }

          didChange = true;
          return {
            ...row,
            AcctCode: sourceValue,
          };
        });

        if (!didChange) {
          return prevRows;
        }

        return nextRows;
      });
    },
    [rowKeyGetter, visibleRowKeys]
  );

  const columns = useMemo(() => {
    return baseColumns.map((column, columnIndex) => {
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
            options={columnOptions.get(columnKey)}
            onChange={(value) => handleFilterChange(columnKey, value)}
          />
        ),
        renderCell: (cellProps) => {
          const allowDrag = columnKey === "AcctCode";
          return (
            <DraggableCell<TicketRow>
              {...cellProps}
              columnIndex={columnIndex}
              rowKey={rowKeyGetter(cellProps.row)}
              onDropValue={handleCellValueDrop}
              canDrag={allowDrag}
              canDrop={allowDrag}
            />
          );
        },
      };
    });
  }, [
    baseColumns,
    dateColumns,
    columnOptions,
    filters,
    handleCellValueDrop,
    handleFilterChange,
    numericColumns,
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

function TextEditor<R extends Record<string, unknown>>({
  row,
  column,
  onRowChange,
}: RenderEditCellProps<R>) {
  const key = column.key as keyof R;
  const val = row[key] as unknown as string | undefined;

  const commit = (raw: string) => {
    onRowChange(
      {
        ...row,
        [key]: (raw as unknown) as R[typeof key],
      },
      true
    );
  };

  return (
    <input
      autoFocus
      type="text"
      value={val ?? ""}
      onChange={(event) => commit(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
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

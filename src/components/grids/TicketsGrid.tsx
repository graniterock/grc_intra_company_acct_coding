"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DataGrid, type Column, type SortColumn } from "react-data-grid";
import type { FillEvent, RenderCellProps, RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";
import { DraggableCell, type DragLocation } from "./DraggableCell";
import { TextEditor } from "./TextEditor";

type TicketRow = {
  id: string;
  UniqueID: string;
  ItemNo: string;
  TicketNo: string;
  LocationID: string;
  JobNumber: string;
  CustomerID: string;
  OrderID: string;
  ProductID: string;
  Description: string;
  TicketDate: string;
  Unit: string;
  Qty: number | null;
  UnitPrice: number | null;
  JobName: string;
  AcctCode: string;
};

type TicketRowField = Exclude<keyof TicketRow, "id">;

type TicketApiRow = {
  TicketNo: string | number | null;
  UniqueID: string | number | null;
  ItemNo: string | number | null;
  LocationID: string | number | null;
  JobNumber: string | null;
  CustomerID: string | number | null;
  OrderID: string | number | null;
  ProductID: string | number | null;
  Description: string | null;
  TicketDate: string | Date | null;
  Unit: string | null;
  Qty: number | string | null;
  UnitPrice: number | string | null;
  JobName: string | null;
};

type TicketsGridProps = {
  height?: number | string;
};

const formatDate = (value: TicketApiRow["TicketDate"]): string => {
  if (!value) return "";
  const candidate =
    value instanceof Date ? value : new Date(typeof value === "string" ? value : String(value));
  if (Number.isNaN(candidate.getTime())) return "";
  return candidate.toISOString().slice(0, 10);
};

const asString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const asNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toTicketRow = (record: TicketApiRow, index: number): TicketRow => {
  const ticketNo = asString(record.TicketNo);
  const uniqueId = asString(record.UniqueID);
  const itemNo = asString(record.ItemNo);
  const rowId =
    uniqueId !== ""
      ? itemNo !== ""
        ? `${uniqueId}-${itemNo}`
        : uniqueId
      : `${ticketNo || "ticket"}-${index}`;

  return {
    id: rowId,
    UniqueID: uniqueId,
    ItemNo: itemNo,
    TicketNo: ticketNo,
    LocationID: asString(record.LocationID),
    JobNumber: asString(record.JobNumber),
    CustomerID: asString(record.CustomerID),
    OrderID: asString(record.OrderID),
    ProductID: asString(record.ProductID),
    Description: asString(record.Description),
    TicketDate: formatDate(record.TicketDate),
    Unit: asString(record.Unit),
    Qty: asNumber(record.Qty),
    UnitPrice: asNumber(record.UnitPrice),
    JobName: asString(record.JobName),
    AcctCode: "",
  };
};

export default function TicketsGrid({ height = 500 }: TicketsGridProps) {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [filters, setFilters] = useState<Partial<Record<TicketRowField, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    []
  );

  const baseColumns = useMemo<ReadonlyArray<Column<TicketRow>>>(() => {
    return [
      { key: "TicketNo", name: "Ticket #", width: 140, resizable: true },
      { key: "LocationID", name: "Location", width: 108 },
      { key: "JobNumber", name: "Job #", width: 124 },
      {
        key: "JobName",
        name: "Job Name",
        width: 220,
        minWidth: 200,
        resizable: true,
      },
      { key: "CustomerID", name: "Customer #", width: 140 },
      { key: "OrderID", name: "Order #", width: 140 },
      { key: "ProductID", name: "Product #", width: 140 },
      {
        key: "Description",
        name: "Description",
        resizable: true,
        width: 260,
        minWidth: 220,
      },
      {
        key: "TicketDate",
        name: "Ticket Date",
        width: 130,
      },
      {
        key: "AcctCode",
        name: "Acct Code",
        width: 160,
        editable: true,
        renderEditCell: TextEditor<TicketRow>,
      },
      { key: "Unit", name: "Unit", width: 90 },
      {
        key: "Qty",
        name: "Qty",
        width: 80,
      },
      {
        key: "UnitPrice",
        name: "Unit Price",
        width: 120,
      },
    ];
  }, []);

  const dateColumns = useMemo(() => new Set<TicketRowField>(["TicketDate"]), []);
  const numericColumns = useMemo(
    () => new Set<TicketRowField>(["Qty", "UnitPrice"]),
    []
  );
  const columnKeys = useMemo(
    () => baseColumns.map((column) => column.key as TicketRowField),
    [baseColumns]
  );

  const columnOptions = useMemo(() => {
    const filterEntries = (Object.entries(filters) as Array<[TicketRowField, string]>).filter(
      ([, value]) => Boolean(value)
    );

    const matchesFilter = (
      row: TicketRow,
      key: TicketRowField,
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

    const optionsMap = new Map<TicketRowField, string[]>();

    columnKeys.forEach((columnKey) => {
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
  }, [rows, columnKeys, filters, dateColumns, collator]);

  const rowKeyGetter = useCallback((row: TicketRow) => row.id, []);

  const filteredRows = useMemo(() => {
    if (Object.keys(filters).length === 0) return rows;
    return rows.filter((row) =>
      (Object.entries(filters) as Array<[TicketRowField, string]>).every(
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
        const columnKey = sort.columnKey as TicketRowField;
        const directionMultiplier = sort.direction === "ASC" ? 1 : -1;
        const aValue = a[columnKey];
        const bValue = b[columnKey];

        if (aValue === bValue) {
          continue;
        }

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
    (columnKey: TicketRowField, shiftKey: boolean) => {
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

  const handleReset = useCallback(() => {
    setFilters({});
    setSortColumns([]);
    setSaveError(null);
    setSaveMessage(null);
  }, []);

  const totalRowCount = rows.length;
  const activeFilterCount = Object.keys(filters).length;
  const filteredRowCount = activeFilterCount > 0 ? filteredRows.length : 0;
  const hasSaveableRows = useMemo(
    () =>
      rows.some(
        (row) =>
          row.AcctCode &&
          row.AcctCode.trim().length > 0 &&
          row.TicketNo &&
          row.UniqueID &&
          row.ItemNo &&
          row.ProductID &&
          row.LocationID &&
          row.OrderID &&
          row.TicketDate
      ),
    [rows]
  );

  const handleFilterChange = useCallback(
    (key: TicketRowField, value: string) => {
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
          if (!keysToUpdate.has(rowKeyGetter(row))) {
            return row;
          }
          if (row.AcctCode === sourceValue) {
            return row;
          }

          didChange = true;
          return { ...row, AcctCode: sourceValue };
        });

        return didChange ? nextRows : prevRows;
      });
    },
    [rowKeyGetter, visibleRowKeys]
  );

  const columns = useMemo(() => {
    return baseColumns.map((column, columnIndex) => {
      const columnKey = column.key as TicketRowField;

      const inputType: FilterInputType = dateColumns.has(columnKey)
        ? "date"
        : numericColumns.has(columnKey)
        ? "number"
        : "text";
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
        renderCell: (cellProps: RenderCellProps<TicketRow>) => {
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
    columnOptions,
    dateColumns,
    filters,
    handleCellValueDrop,
    handleFilterChange,
    numericColumns,
    rowKeyGetter,
    sortColumns,
    toggleSortColumn,
  ]);

  const resolvedHeight =
    typeof height === "number" ? `${height}px` : height;

  const gridStyle: CSSProperties = {
    height: "100%",
    width: "100%",
    "--rdg-background-color": "#e6eaed",
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

  const handleRetrieve = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/tickets", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        const trimmed = text.trim();
        const statusNote = `Request failed (${response.status}${
          response.statusText ? ` ${response.statusText}` : ""
        })`;
        let message = statusNote;
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed) as { error?: string };
            if (parsed?.error) {
              message = `${statusNote}: ${parsed.error}`;
            }
          } catch {
            if (!/^<!doctype html/i.test(trimmed) && !/^<html/i.test(trimmed)) {
              message = `${statusNote}: ${trimmed}`;
            }
          }
        }
        throw new Error(message);
      }

      const data = (await response.json()) as {
        rows?: TicketApiRow[];
        error?: string;
      };

      if (!data.rows) {
        throw new Error(data.error || "No data returned from server");
      }

      const mapped = data.rows.map((record, index) => toTicketRow(record, index));
      setRows(mapped);
      setFilters({});
      setSaveMessage(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasSaveableRows) {
      setSaveError("No rows with an account code to save.");
      setSaveMessage(null);
      return;
    }

    const candidates = rows.filter(
      (row) =>
        row.TicketNo &&
        row.UniqueID &&
        row.ItemNo &&
        row.ProductID &&
        row.LocationID &&
        row.OrderID &&
        row.TicketDate &&
        row.AcctCode &&
        row.AcctCode.trim().length > 0
    );

    if (candidates.length === 0) {
      setSaveError("No rows with an account code to save.");
      setSaveMessage(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = candidates.map((row) => ({
        TicketNo: row.TicketNo,
        UniqueID: row.UniqueID,
        ItemNo: row.ItemNo,
        ProductID: row.ProductID,
        LocationID: row.LocationID,
        OrderID: row.OrderID,
        TicketDate: row.TicketDate,
        TicketAccountCode: row.AcctCode.trim(),
      }));

      const response = await fetch("/api/tickets/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: payload }),
      });

      if (!response.ok) {
        const text = await response.text();
        const trimmed = text.trim();
        let message = "Unable to save ticket data.";

        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed) as { error?: string };
            if (parsed?.error) {
              message = parsed.error;
            } else {
              message = trimmed;
            }
          } catch {
            if (!/^<!doctype html/i.test(trimmed) && !/^<html/i.test(trimmed)) {
              message = trimmed;
            }
          }
        }

        throw new Error(message);
      }

      const result = (await response.json()) as { saved?: number };
      const savedCount = result?.saved ?? 0;
      setSaveMessage(
        savedCount > 0
          ? `Saved ${savedCount} row${savedCount === 1 ? "" : "s"}.`
          : "No rows were saved."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save ticket data.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [rows, hasSaveableRows]);

  return (
    <div
      className="w-full flex flex-col"
      style={{ height: resolvedHeight, minHeight: 400, gap: "12px" }}
    >
      <div
        className="flex flex-wrap items-center gap-3 rounded-md"
        style={{
          backgroundColor: "var(--gr-green)",
          padding: "10px 14px",
        }}
      >
        <button
          type="button"
          onClick={handleRetrieve}
          disabled={isLoading}
          className="px-4 py-2 rounded-md font-medium"
        style={{
          backgroundColor: "#B9BBB6",
          border: "1px solid color-mix(in srgb, #B9BBB6 70%, black)",
          color: "#000000",
          fontWeight: 700,
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? "not-allowed" : "pointer",
        }}
      >
          {isLoading ? "Retrieving..." : "Retrieve Tickets"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving || !hasSaveableRows}
          className="px-4 py-2 rounded-md font-medium"
        style={{
          backgroundColor: "#B9BBB6",
          border: "1px solid color-mix(in srgb, #B9BBB6 70%, black)",
          color: "#000000",
          fontWeight: 700,
          cursor: isLoading || isSaving || !hasSaveableRows ? "not-allowed" : "pointer",
          opacity: isLoading || isSaving || !hasSaveableRows ? 0.7 : 1,
        }}
        >
          {isSaving ? "Saving..." : "Save Tickets"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading}
          className="px-4 py-2 rounded-md font-medium"
        style={{
          backgroundColor: "#B9BBB6",
          border: "1px solid color-mix(in srgb, #B9BBB6 70%, black)",
          color: "#000000",
          fontWeight: 700,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.7 : 1,
        }}
        >
          Reset Filters
        </button>
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--gr-orange)" }}
          aria-live="polite"
        >
          <span>
            Total rows: <span className="font-semibold">{totalRowCount}</span>
          </span>
          <span aria-hidden="true">|</span>
          <span>
            Filtered rows: <span className="font-semibold">{filteredRowCount}</span>
          </span>
        </div>
        {loadError ? (
          <span className="text-sm" style={{ color: "var(--gr-error, #b00020)" }}>
            {loadError}
          </span>
        ) : null}
        {saveError ? (
          <span className="text-sm" style={{ color: "var(--gr-error, #b00020)" }}>
            {saveError}
          </span>
        ) : saveMessage ? (
          <span className="text-sm" style={{ color: "var(--gr-green-dark, #0c5132)" }}>
            {saveMessage}
          </span>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 w-full">
        <DataGrid<TicketRow>
          columns={columns}
          rows={sortedRows}
          onRowsChange={handleRowsChange}
          rowKeyGetter={rowKeyGetter}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          defaultColumnOptions={{ resizable: true }}
          /* Drag-to-fill (TS-safe cast of RDG FillEvent) */
          onFill={(event: FillEvent<TicketRow>) => {
            const columnKey = event.columnKey as TicketRowField;
            if (columnKey === undefined) return event.targetRow;
            return {
              ...event.targetRow,
              [columnKey]: event.sourceRow[columnKey],
            };
          }}
          headerRowHeight={64}
          style={gridStyle}
        />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DataGrid, type Column, type SortColumn } from "react-data-grid";
import type {
  FillEvent,
  RenderCellProps,
  RenderEditCellProps,
  RowsChangeData,
} from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";
import { DraggableCell, type DragLocation } from "./DraggableCell";

type AccountValidationStatus = "unknown" | "pending" | "valid" | "invalid";

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
  TicketDateDisplay: string;
  TicketDateTime: string | null;
  Unit: string;
  Qty: number | null;
  UnitPrice: number | null;
  ExtendedCost: number | null;
  JobName: string;
  AcctCode: string;
  TaskDesc: string;
  AcctDesc: string;
  acctValidationStatus: AccountValidationStatus;
  acctValidationCode: string | null;
  OnHold: string | null;
  IsWorkingRow: boolean;
};

type TicketRowField = Exclude<
  keyof TicketRow,
  | "id"
  | "TicketDateDisplay"
  | "TicketDateTime"
  | "OnHold"
  | "IsWorkingRow"
  | "acctValidationStatus"
  | "acctValidationCode"
>;

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
  TicketDateTime?: string | Date | null;
  Unit: string | null;
  Qty: number | string | null;
  UnitPrice: number | string | null;
  JobName: string | null;
  TicketAccountCode?: string | null;
  OnHold?: string | null;
  IsWorkingRow?: boolean | number | null;
};

type TicketsGridProps = {
  height?: number | string;
};

type AccountCodeEditorProps = RenderEditCellProps<TicketRow> & {
  onCommitBlur: (rowId: string, value: string) => void;
  onCommitStart: (rowId: string, value: string) => void;
};

function AccountCodeEditor({
  row,
  column,
  onRowChange,
  onCommitBlur,
  onCommitStart,
}: AccountCodeEditorProps) {
  const key = column.key as keyof TicketRow;
  const value = row[key] as unknown as string | undefined;

  const commit = (next: string, commitChanges = false) => {
    onRowChange(
      {
        ...row,
        [key]: (next as unknown) as TicketRow[typeof key],
      },
      commitChanges
    );
  };

  return (
    <input
      autoFocus
      type="text"
      value={value ?? ""}
      onChange={(event) => commit(event.target.value, false)}
      onBlur={(event) => {
        const next = event.target.value;
        onCommitStart(row.id, next);
        commit(next, true);
        onCommitBlur(row.id, next);
      }}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        padding: "0 8px",
        backgroundColor: "transparent",
        color: "inherit",
      }}
    />
  );
}

const NO_ACCT_FILTER_VALUE = "No Acct";
const NO_ACCT_FILTER_VALUE_NORMALIZED = NO_ACCT_FILTER_VALUE.toLowerCase();
const COLUMN_ORDER_STORAGE_KEY = "grc:tickets-grid-column-order";
const INVALID_ACCT_LABEL = "Invalid Acct";
type AccountValidationResult = {
  code: string;
  isValid: boolean;
  taskDesc: string;
  acctDesc: string;
};

const normalizeAccountCode = (value: string): string =>
  value.trim().toUpperCase();

const parseDateValue = (
  value: TicketApiRow["TicketDate"] | TicketApiRow["TicketDateTime"]
): Date | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const candidate = new Date(
    typeof value === "string" ? value : String(value)
  );
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const formatDateDisplay = (value: Date | null): string => {
  if (!value) return "";
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${month}/${day}/${year}`;
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "";
  return currencyFormatter.format(value);
};

const asString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const asNullableString = (
  value: string | number | null | undefined
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
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
  const parsedTicketDate =
    parseDateValue(record.TicketDateTime) ?? parseDateValue(record.TicketDate);
  const ticketDateDisplay = formatDateDisplay(parsedTicketDate);
  const ticketDateIso = parsedTicketDate
    ? parsedTicketDate.toISOString()
    : null;
  const ticketDateKey = ticketDateIso ? ticketDateIso.slice(0, 10) : "";

  const qtyNumber = asNumber(record.Qty);
  const unitPriceNumber = asNumber(record.UnitPrice);
  const extendedCost =
    qtyNumber !== null && unitPriceNumber !== null
      ? qtyNumber * unitPriceNumber
      : null;

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
    TicketDate: ticketDateKey,
    TicketDateDisplay: ticketDateDisplay,
    TicketDateTime: ticketDateIso,
    Unit: asString(record.Unit),
    Qty: qtyNumber,
    UnitPrice: unitPriceNumber,
    ExtendedCost: extendedCost,
    JobName: asString(record.JobName),
    AcctCode: asString(record.TicketAccountCode),
    TaskDesc: "",
    AcctDesc: "",
    acctValidationStatus: "unknown",
    acctValidationCode: null,
    OnHold: asNullableString(record.OnHold),
    IsWorkingRow: Boolean(record.IsWorkingRow),
  };
};

export default function TicketsGrid({ height = 500 }: TicketsGridProps) {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [filters, setFilters] = useState<Partial<Record<TicketRowField, string>>>({});
  const [jobFilter, setJobFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [bulkValidationSignal, setBulkValidationSignal] = useState(0);
  const initialRowsValidationTriggeredRef = useRef(false);
  const pendingAcctCodeCommitRef = useRef<{ rowId: string; value: string } | null>(null);
  const lastBulkValidationScheduledRef = useRef(0);

  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    []
  );


  const dateColumns = useMemo(() => new Set<TicketRowField>(["TicketDate"]), []);
  const numericColumns = useMemo(() => {
    return new Set<TicketRowField>(["Qty", "UnitPrice", "ExtendedCost"]);
  }, []);

  const runValidationForRowIds = useCallback(
    async (
      rowIds: string[],
      options: {
        showSpinner?: boolean;
        codeOverrides?: Map<string, string>;
      } = {}
    ) => {
      if (rowIds.length === 0) {
        return;
      }

      const rowIdSet = new Set(rowIds);
      const overrides = options.codeOverrides;
      const codesToValidate: string[] = [];

      setValidationError(null);

      setRows((prevRows) =>
        prevRows.map((row) => {
          if (!rowIdSet.has(row.id)) {
            return row;
          }

          const override = overrides?.get(row.id);
          const normalized = override ?? normalizeAccountCode(row.AcctCode ?? "");
          if (normalized.length === 0) {
            return {
              ...row,
              AcctCode: "",
              TaskDesc: "",
              AcctDesc: "",
              acctValidationStatus: "valid" as AccountValidationStatus,
              acctValidationCode: null,
            };
          }

          codesToValidate.push(normalized);

          return {
            ...row,
            AcctCode: normalized,
            acctValidationStatus: "pending" as AccountValidationStatus,
            acctValidationCode: normalized,
          };
        })
      );

      const uniqueCodeSet = new Set<string>();
      codesToValidate.forEach((code) => {
        if (code.length > 0) {
          uniqueCodeSet.add(code);
        }
      });
      if (overrides) {
        for (const code of overrides.values()) {
          const normalized = normalizeAccountCode(code ?? "");
          if (normalized.length > 0) {
            uniqueCodeSet.add(normalized);
          }
        }
      }
      const uniqueCodes = Array.from(uniqueCodeSet);
      if (uniqueCodes.length === 0) {
        setRows((prevRows) =>
          prevRows.map((row) => {
            if (!rowIdSet.has(row.id)) {
              return row;
            }
            const normalized = normalizeAccountCode(row.AcctCode ?? "");
            return {
              ...row,
              TaskDesc: normalized.length > 0 ? row.TaskDesc : "",
              AcctDesc: normalized.length > 0 ? row.AcctDesc : "",
              acctValidationStatus: "valid" as AccountValidationStatus,
              acctValidationCode: normalized.length > 0 ? normalized : null,
            };
          })
        );
        return;
      }

      if (options.showSpinner) {
        setIsValidating(true);
      }

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);
        const response = await fetch("/api/account/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ codes: uniqueCodes }),
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (!response.ok) {
          const text = await response.text();
          const trimmed = text.trim();
          let message = `Unable to validate account codes (HTTP ${response.status}${
            response.statusText ? ` ${response.statusText}` : ""
          }).`;

          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed) as { error?: string };
              if (parsed?.error) {
                message = parsed.error;
              } else if (!/^<!doctype html/i.test(trimmed) && !/^<html/i.test(trimmed)) {
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

        const payload = (await response.json()) as {
          results?: AccountValidationResult[];
          error?: string;
        };

        if (!payload.results) {
          throw new Error(payload.error || "No validation results returned.");
        }

        const resultMap = new Map<string, AccountValidationResult>();
        payload.results.forEach((result) => {
          resultMap.set(normalizeAccountCode(result.code), result);
        });

        setRows((prevRows) =>
          prevRows.map((row) => {
            if (!rowIdSet.has(row.id)) {
              return row;
            }

            const code = row.acctValidationCode;
            if (!code) {
              return row;
            }

            const lookup = resultMap.get(code);
            if (!lookup) {
              return {
                ...row,
                TaskDesc: INVALID_ACCT_LABEL,
                AcctDesc: INVALID_ACCT_LABEL,
                acctValidationStatus: "invalid" as AccountValidationStatus,
                acctValidationCode: null,
              };
            }

            if (!lookup.isValid) {
              return {
                ...row,
                TaskDesc: lookup.taskDesc || INVALID_ACCT_LABEL,
                AcctDesc: lookup.acctDesc || INVALID_ACCT_LABEL,
                acctValidationStatus: "invalid" as AccountValidationStatus,
                acctValidationCode: code,
              };
            }

            return {
              ...row,
              TaskDesc: lookup.taskDesc,
              AcctDesc: lookup.acctDesc,
              acctValidationStatus: "valid" as AccountValidationStatus,
              acctValidationCode: code,
            };
          })
        );
      } catch (error) {
        const isAbort =
          error instanceof DOMException && error.name === "AbortError";
        const message =
          error instanceof Error
            ? error.message
            : "Unable to validate account codes.";
        setValidationError(
          isAbort ? "Account validation timed out." : message
        );
        setRows((prevRows) =>
          prevRows.map((row) => {
            if (!rowIdSet.has(row.id)) {
              return row;
            }
            if (row.acctValidationStatus !== "pending") {
              return row;
            }
            return {
              ...row,
              acctValidationStatus: "unknown" as AccountValidationStatus,
            };
          })
        );
      } finally {
        if (options.showSpinner) {
          setIsValidating(false);
        }
      }
    },
    []
  );

  const handleAcctCodeBlur = useCallback(
    (rowId: string, value: string) => {
      const normalized = normalizeAccountCode(value ?? "");

      setRows((prevRows) =>
        prevRows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }

      if (normalized.length === 0) {
        return {
          ...row,
          AcctCode: "",
          TaskDesc: "",
          AcctDesc: "",
          acctValidationStatus: "valid" as AccountValidationStatus,
          acctValidationCode: null,
        };
      }

      return {
        ...row,
        AcctCode: normalized,
        TaskDesc: "",
        AcctDesc: "",
        acctValidationStatus: "unknown" as AccountValidationStatus,
        acctValidationCode: normalized,
      };
    })
      );

    },
    []
  );

  const handleAcctCodeCommitStart = useCallback((rowId: string, value: string) => {
    pendingAcctCodeCommitRef.current = { rowId, value };
  }, []);

  const baseColumns = useMemo<ReadonlyArray<Column<TicketRow>>>(() => {
    return [
      { key: "TicketNo", name: "Ticket #", width: 140, resizable: true },
      { key: "LocationID", name: "Location", width: 108 },
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
        renderEditCell: (props: RenderEditCellProps<TicketRow>) => (
          <AccountCodeEditor
            {...props}
            onCommitBlur={handleAcctCodeBlur}
            onCommitStart={handleAcctCodeCommitStart}
          />
        ),
      },
      {
        key: "TaskDesc",
        name: "TaskCode Description",
        width: 220,
        editable: false,
      },
      {
        key: "AcctDesc",
        name: "Account Description",
        width: 220,
        editable: false,
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
      {
        key: "ExtendedCost",
        name: "Extended Cost",
        width: 140,
      },
    ];
  }, [handleAcctCodeBlur, handleAcctCodeCommitStart]);
  const columnKeys = useMemo(
    () => baseColumns.map((column) => column.key as TicketRowField),
    [baseColumns]
  );

  const columnKeySet = useMemo(
    () => new Set<TicketRowField>(columnKeys),
    [columnKeys]
  );

  const [columnOrder, setColumnOrder] = useState<TicketRowField[]>(() => [
    ...columnKeys,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const valid: TicketRowField[] = [];
      for (const key of parsed) {
        if (typeof key === "string") {
          const typedKey = key as TicketRowField;
          if (columnKeySet.has(typedKey) && !valid.includes(typedKey)) {
            valid.push(typedKey);
          }
        }
      }
      if (valid.length === 0) return;
      const merged = [...valid];
      columnKeys.forEach((key) => {
        if (!merged.includes(key)) {
          merged.push(key);
        }
      });
      setColumnOrder((prev) => {
        if (
          prev.length === merged.length &&
          prev.every((key, index) => key === merged[index])
        ) {
          return prev;
        }
        return merged;
      });
    } catch {
      // ignore malformed storage
    }
  }, [columnKeySet, columnKeys]);

  useEffect(() => {
    setColumnOrder((prev) => {
      const sanitized = prev.filter((key) => columnKeySet.has(key));
      const missing = columnKeys.filter((key) => !sanitized.includes(key));
      if (missing.length === 0 && sanitized.length === prev.length) {
        return prev;
      }
      return [...sanitized, ...missing];
    });
  }, [columnKeySet, columnKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!columnKeys.every((key) => columnOrder.includes(key))) return;
    window.localStorage.setItem(
      COLUMN_ORDER_STORAGE_KEY,
      JSON.stringify(columnOrder)
    );
  }, [columnOrder, columnKeys]);

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => ({
        job: row.JobNumber.trim(),
        customer: row.CustomerID.trim(),
        order: row.OrderID.trim(),
      })),
    [rows]
  );

  const jobNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      const jobNumber = row.JobNumber.trim();
      if (!jobNumber || map.has(jobNumber)) return;
      map.set(jobNumber, row.JobName);
    });
    return map;
  }, [rows]);

  const jobOptions = useMemo(() => {
    const customerCriterion = customerFilter.trim();
    const orderCriterion = orderFilter.trim();
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (customerCriterion && row.customer !== customerCriterion) return;
      if (orderCriterion && row.order !== orderCriterion) return;
      if (row.job) {
        set.add(row.job);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, customerFilter, orderFilter]);

  const customerOptions = useMemo(() => {
    const jobCriterion = jobFilter.trim();
    const orderCriterion = orderFilter.trim();
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (jobCriterion && row.job !== jobCriterion) return;
      if (orderCriterion && row.order !== orderCriterion) return;
      if (row.customer) {
        set.add(row.customer);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, jobFilter, orderFilter]);

  const orderOptions = useMemo(() => {
    const jobCriterion = jobFilter.trim();
    const customerCriterion = customerFilter.trim();
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (jobCriterion && row.job !== jobCriterion) return;
      if (customerCriterion && row.customer !== customerCriterion) return;
      if (row.order) {
        set.add(row.order);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, jobFilter, customerFilter]);

  const selectedJobName = jobFilter
    ? jobNameLookup.get(jobFilter.trim()) ?? ""
    : "";

  const matchesTopLevelFilters = useCallback(
    (row: TicketRow) => {
      const jobCriterion = jobFilter.trim();
      if (jobCriterion && row.JobNumber.trim() !== jobCriterion) {
        return false;
      }
      const customerCriterion = customerFilter.trim();
      if (customerCriterion && row.CustomerID.trim() !== customerCriterion) {
        return false;
      }
      const orderCriterion = orderFilter.trim();
      if (orderCriterion && row.OrderID.trim() !== orderCriterion) {
        return false;
      }
      return true;
    },
    [jobFilter, customerFilter, orderFilter]
  );

  const columnOptions = useMemo(() => {
    const filterEntries = (Object.entries(filters) as Array<[TicketRowField, string]>).filter(
      ([, value]) => Boolean(value)
    );

    const baseRows = rows.filter(matchesTopLevelFilters);

    const matchesFilter = (
      row: TicketRow,
      key: TicketRowField,
      filterValue: string
    ): boolean => {
      if (!filterValue) return true;

      const normalizedFilter = filterValue.trim().toLowerCase();
      if (key === "AcctCode" && normalizedFilter === NO_ACCT_FILTER_VALUE_NORMALIZED) {
        const rawValue = row[key];
        const normalizedValue =
          rawValue === undefined || rawValue === null
            ? ""
            : String(rawValue).trim();
        return normalizedValue === "";
      }

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
          ? baseRows
          : baseRows.filter((row) =>
              otherFilters.every(([key, filterValue]) => matchesFilter(row, key, filterValue))
            );

      const valueSet = new Set<string>();
      let includeNoAcctOption = false;
      relevantRows.forEach((row) => {
        const value = row[columnKey];
        const normalizedValue =
          value === undefined || value === null ? "" : String(value).trim();
        if (normalizedValue === "") {
          if (columnKey === "AcctCode") {
            includeNoAcctOption = true;
          }
          return;
        }
        valueSet.add(normalizedValue);
      });

      const sortedOptions = Array.from(valueSet).sort(collator.compare);
      if (columnKey === "AcctCode" && includeNoAcctOption) {
        const existingIndex = sortedOptions.findIndex(
          (option) => option.toLowerCase() === NO_ACCT_FILTER_VALUE_NORMALIZED
        );
        if (existingIndex !== -1) {
          sortedOptions.splice(existingIndex, 1);
        }
        sortedOptions.unshift(NO_ACCT_FILTER_VALUE);
      }

      optionsMap.set(columnKey, sortedOptions);
    });

    return optionsMap;
  }, [rows, columnKeys, filters, dateColumns, collator, matchesTopLevelFilters]);

  const rowKeyGetter = useCallback((row: TicketRow) => row.id, []);

  const filteredRows = useMemo(() => {
    const rowsWithTopLevelFilters =
      jobFilter || customerFilter || orderFilter ? rows.filter(matchesTopLevelFilters) : rows;

    if (Object.keys(filters).length === 0) return rowsWithTopLevelFilters;
    return rowsWithTopLevelFilters.filter((row) =>
      (Object.entries(filters) as Array<[TicketRowField, string]>).every(
        ([key, filterValue]) => {
          if (!filterValue) return true;

          const normalizedFilter = filterValue.trim().toLowerCase();
          if (key === "AcctCode" && normalizedFilter === NO_ACCT_FILTER_VALUE_NORMALIZED) {
            const rawValue = row[key];
            const normalizedValue =
              rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();
            return normalizedValue === "";
          }

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
  }, [
    rows,
    filters,
    dateColumns,
    matchesTopLevelFilters,
    jobFilter,
    customerFilter,
    orderFilter,
  ]);

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

  const validateRow = useCallback(
    async (row: TicketRow) => {
      await runValidationForRowIds([row.id], { showSpinner: true });
    },
    [runValidationForRowIds]
  );

  const validateAllVisibleRows = useCallback(async () => {
    if (visibleRowKeys.length === 0) {
      return;
    }
    await runValidationForRowIds([...visibleRowKeys], { showSpinner: true });
  }, [visibleRowKeys, runValidationForRowIds]);

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
    setValidationError(null);
  }, []);

  const handleClearTopFilters = useCallback(() => {
    setJobFilter("");
    setCustomerFilter("");
    setOrderFilter("");
  }, []);

  const handleValidateVisible = useCallback(() => {
    if (visibleRowKeys.length === 0) {
      return;
    }

    if (visibleRowKeys.length === 1) {
      const targetRow = sortedRows.find(
        (row) => rowKeyGetter(row) === visibleRowKeys[0]
      );
      if (targetRow) {
        void validateRow(targetRow);
        return;
      }
    }

    void validateAllVisibleRows();
  }, [
    visibleRowKeys,
    sortedRows,
    rowKeyGetter,
    validateRow,
    validateAllVisibleRows,
  ]);

  const requestBulkValidation = useCallback(() => {
    setBulkValidationSignal((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (bulkValidationSignal === 0) {
      return;
    }
    if (rows.length === 0) {
      return;
    }
    if (lastBulkValidationScheduledRef.current === bulkValidationSignal) {
      return;
    }

    lastBulkValidationScheduledRef.current = bulkValidationSignal;

    if (typeof window === "undefined") {
      void validateAllVisibleRows();
      return;
    }

    const rafHandles: number[] = [];
    const scheduleValidation = () => {
      const validateHandle = window.requestAnimationFrame(() => {
        if (typeof queueMicrotask === "function") {
          queueMicrotask(() => {
            void validateAllVisibleRows();
          });
        } else {
          void validateAllVisibleRows();
        }
      });
      rafHandles.push(validateHandle);
    };

    const paintHandle = window.requestAnimationFrame(() => {
      scheduleValidation();
    });
    rafHandles.push(paintHandle);

    return () => {
      rafHandles.forEach((handle) => {
        window.cancelAnimationFrame(handle);
      });
    };
  }, [bulkValidationSignal, rows.length, validateAllVisibleRows]);

  useEffect(() => {
    if (initialRowsValidationTriggeredRef.current) {
      return;
    }
    if (rows.length === 0) {
      return;
    }
    initialRowsValidationTriggeredRef.current = true;
    requestBulkValidation();
  }, [rows.length, requestBulkValidation]);

  const totalRowCount = rows.length;
  const topLevelFilterCount =
    (jobFilter.trim() ? 1 : 0) +
    (customerFilter.trim() ? 1 : 0) +
    (orderFilter.trim() ? 1 : 0);
  const hasTopFiltersApplied = topLevelFilterCount > 0;
  const activeFilterCount = Object.keys(filters).length + topLevelFilterCount;
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

  const saveStatus = useMemo(() => {
    if (saveError) {
      return { message: saveError, tone: "error" as const };
    }
    if (saveMessage) {
      return { message: saveMessage, tone: "success" as const };
    }
    return null;
  }, [saveError, saveMessage]);

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

      const affectedRowIds = new Set<string>();
      const overrides = new Map<string, string>();
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
        const normalizedSource = normalizeAccountCode(sourceValue ?? "");
        const startVisible = Math.min(sourceVisibleIndex, targetVisibleIndex);
        const endVisible = Math.max(sourceVisibleIndex, targetVisibleIndex);
        const keysToUpdate = new Set(
          visibleRowKeys.slice(startVisible, endVisible + 1)
        );

        let didChange = false;

        const nextRows = prevRows.map((row) => {
          const rowKey = rowKeyGetter(row);
          if (!keysToUpdate.has(rowKey)) {
            return row;
          }
          if (row.AcctCode === normalizedSource) {
            return row;
          }

          didChange = true;
          affectedRowIds.add(rowKey);

          if (normalizedSource.length === 0) {
            return {
              ...row,
              AcctCode: "",
              TaskDesc: "",
              AcctDesc: "",
              acctValidationStatus: "valid" as AccountValidationStatus,
              acctValidationCode: null,
            };
          }

          overrides.set(rowKey, normalizedSource);

          return {
            ...row,
            AcctCode: normalizedSource,
            TaskDesc: "",
            AcctDesc: "",
            acctValidationStatus: "unknown" as AccountValidationStatus,
            acctValidationCode: normalizedSource,
          };
        });

        return didChange ? nextRows : prevRows;
      });

      if (affectedRowIds.size > 0) {
        const ids = Array.from(affectedRowIds);
        const overrideSnapshot = new Map(overrides);
        window.setTimeout(() => {
          void runValidationForRowIds(ids, {
            codeOverrides: overrideSnapshot,
            showSpinner: true,
          });
        }, 0);
      }
    },
    [rowKeyGetter, visibleRowKeys, runValidationForRowIds]
  );

  const handleColumnsReorder = useCallback(
    (sourceKey: string, targetKey: string) => {
      const source = sourceKey as TicketRowField;
      const target = targetKey as TicketRowField;
      if (!columnKeySet.has(source) || !columnKeySet.has(target)) {
        return;
      }
      setColumnOrder((prev) => {
        const current = prev.filter((key) => columnKeySet.has(key));
        const sourceIndex = current.indexOf(source);
        if (sourceIndex === -1) return prev;
        const updated = [...current];
        const [moved] = updated.splice(sourceIndex, 1);
        const nextTargetIndex = updated.indexOf(target);
        if (nextTargetIndex === -1) {
          updated.push(moved);
        } else {
          updated.splice(nextTargetIndex, 0, moved);
        }
        columnKeys.forEach((key) => {
          if (!updated.includes(key)) {
            updated.push(key);
          }
        });
        if (
          updated.length === prev.length &&
          updated.every((key, index) => key === prev[index])
        ) {
          return prev;
        }
        return updated;
      });
    },
    [columnKeySet, columnKeys]
  );

  const baseColumnMap = useMemo(() => {
    const map = new Map<TicketRowField, Column<TicketRow>>();
    baseColumns.forEach((column) => {
      map.set(column.key as TicketRowField, column);
    });
    return map;
  }, [baseColumns]);

const columns = useMemo(() => {
    return columnOrder
      .map((columnKey, columnIndex) => {
        const column = baseColumnMap.get(columnKey);
        if (!column) return null;

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
            const status = cellProps.row.acctValidationStatus;
            const isAcctColumn = columnKey === "AcctCode";
            const isTaskDescColumn = columnKey === "TaskDesc";
            const isAcctDescColumn = columnKey === "AcctDesc";
            const isValidationColumn =
              isAcctColumn || isTaskDescColumn || isAcctDescColumn;

            const renderValue =
              columnKey === "TicketDate"
                ? () => cellProps.row.TicketDateDisplay ?? ""
                : columnKey === "ExtendedCost"
                ? () => formatCurrency(cellProps.row.ExtendedCost)
                : isAcctColumn
                ? () => (
                    <span className="flex items-center gap-2">
                      {status === "pending" ? (
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-full border-2 border-red-200 border-t-red-500 animate-spin"
                        />
                      ) : null}
                      <span>{cellProps.row.AcctCode}</span>
                    </span>
                  )
                : undefined;

            const extraClasses: string[] = [];
            if (status === "invalid" && isValidationColumn) {
              extraClasses.push("bg-red-100", "text-red-800");
            }
            if (status === "pending" && isValidationColumn) {
              extraClasses.push("bg-orange-50");
            }

            return (
              <DraggableCell<TicketRow>
                {...cellProps}
                columnIndex={columnIndex}
                rowKey={rowKeyGetter(cellProps.row)}
                onDropValue={handleCellValueDrop}
                canDrag={allowDrag}
                canDrop={allowDrag}
                renderValue={renderValue}
                className={extraClasses.join(" ")}
              />
            );
          },
        };
      })
      .filter(
        (column): column is Column<TicketRow> =>
          column !== null
      );
  }, [
    baseColumnMap,
    columnOptions,
    dateColumns,
    filters,
    handleCellValueDrop,
    handleFilterChange,
    numericColumns,
    columnOrder,
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

  const toolbarButtonBaseStyles: CSSProperties = {
    background: "#B9BBB6",
    backgroundColor: "#B9BBB6",
    border: "1px solid color-mix(in srgb, #B9BBB6 70%, black)",
    color: "#000000",
    fontWeight: 700,
    boxShadow: "none",
    filter: "none",
  };

  const handleRowsChange = useCallback(
    (updatedRows: TicketRow[], data: RowsChangeData<TicketRow>) => {
      const changedIndexes =
        data.indexes && data.indexes.length > 0
          ? data.indexes
          : updatedRows.map((_, idx) => idx);
      if (changedIndexes.length === 0) return;

      const rowsToValidate: Array<{ id: string; normalized: string }> = [];
      const processedRowIds = new Set<string>();
      const pendingCommit = pendingAcctCodeCommitRef.current;

      setRows((prevRows) => {
        const updatedMap = new Map(prevRows.map((row) => [rowKeyGetter(row), row]));

        const applyRowUpdate = (row: TicketRow, explicitValue?: string) => {
          const key = rowKeyGetter(row);
          const existingRow = updatedMap.get(key);
          if (!existingRow) {
            return;
          }

          processedRowIds.add(key);

          const nextValue =
            explicitValue !== undefined ? explicitValue : (row.AcctCode ?? "");
          const normalized = normalizeAccountCode(nextValue ?? "");

          if (normalized.length === 0) {
            updatedMap.set(key, {
              ...existingRow,
              ...row,
              AcctCode: "",
              TaskDesc: "",
              AcctDesc: "",
              acctValidationStatus: "valid",
              acctValidationCode: null,
            });
            return;
          }

          if (existingRow.AcctCode !== normalized) {
            rowsToValidate.push({ id: key, normalized });
            updatedMap.set(key, {
              ...existingRow,
              ...row,
              AcctCode: normalized,
              TaskDesc: "",
              AcctDesc: "",
              acctValidationStatus: "unknown",
              acctValidationCode: normalized,
            });
            return;
          }

          updatedMap.set(key, { ...existingRow, ...row });
        };

        changedIndexes.forEach((idx) => {
          const updatedRow = updatedRows[idx];
          if (!updatedRow) return;
          const rowId = rowKeyGetter(updatedRow);
          const explicitValue =
            pendingCommit && pendingCommit.rowId === rowId
              ? pendingCommit.value
              : undefined;
          applyRowUpdate(updatedRow, explicitValue);
        });

        if (pendingCommit && !processedRowIds.has(pendingCommit.rowId)) {
          const existingRow = updatedMap.get(pendingCommit.rowId);
          if (existingRow) {
            applyRowUpdate(
              {
                ...existingRow,
                AcctCode: pendingCommit.value,
              },
              pendingCommit.value
            );
          }
        }

        return prevRows.map(
          (row) => updatedMap.get(rowKeyGetter(row)) ?? row
        );
      });

      pendingAcctCodeCommitRef.current = null;

      if (rowsToValidate.length > 0) {
        const overrides = new Map<string, string>();
        const ids: string[] = [];
        rowsToValidate.forEach(({ id, normalized }) => {
          ids.push(id);
          overrides.set(id, normalized);
        });

        window.setTimeout(() => {
          void runValidationForRowIds(ids, {
            codeOverrides: overrides,
            showSpinner: true,
          });
        }, 0);
      }
    },
    [rowKeyGetter, runValidationForRowIds]
  );

  const handleRetrieve = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSaveMessage(null);
    setValidationError(null);
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
      setJobFilter("");
      setCustomerFilter("");
      setOrderFilter("");
      setSaveMessage(null);

      if (mapped.length > 0) {
        if (typeof queueMicrotask === "function") {
          queueMicrotask(() => {
            requestBulkValidation();
          });
        } else {
          requestBulkValidation();
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }, [requestBulkValidation]);

  const handleSave = useCallback(async () => {
    if (!hasSaveableRows) {
      setSaveError("No rows with an account code to save.");
      setSaveMessage(null);
      return;
    }

    const candidates = rows.filter((row) => {
      const ticketDateValue = row.TicketDateTime ?? row.TicketDate;
      return (
        row.TicketNo &&
        row.UniqueID &&
        row.ItemNo &&
        row.ProductID &&
        row.LocationID &&
        row.OrderID &&
        ticketDateValue &&
        String(ticketDateValue).trim().length > 0 &&
        row.AcctCode &&
        row.AcctCode.trim().length > 0
      );
    });

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
        TicketDate: row.TicketDateTime ?? row.TicketDate,
        TicketAccountCode: row.AcctCode.trim(),
        OnHold: row.OnHold ?? undefined,
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
      setSaveMessage(`Saved ${savedCount} row${savedCount === 1 ? "" : "s"}.`);
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
            ...toolbarButtonBaseStyles,
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
            ...toolbarButtonBaseStyles,
            cursor: isLoading || isSaving || !hasSaveableRows ? "not-allowed" : "pointer",
          }}
        >
          {isSaving ? "Saving..." : "Save Tickets"}
        </button>
        <button
          type="button"
          onClick={handleValidateVisible}
          disabled={isLoading || isSaving || isValidating || rows.length === 0}
          className="px-4 py-2 rounded-md font-medium"
          style={{
            ...toolbarButtonBaseStyles,
            cursor:
              isLoading || isSaving || isValidating || rows.length === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isValidating ? "Validating..." : "Validate Codes"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading}
          className="px-4 py-2 rounded-md font-medium"
          style={{
            ...toolbarButtonBaseStyles,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          Reset Filters
        </button>
        <div className="flex items-center gap-3 flex-wrap flex-1">
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
          {saveStatus ? (
            <div
              role="status"
              aria-live="polite"
              className="text-sm font-medium px-3 py-2 rounded-md border"
              style={{
                minWidth: "200px",
                textAlign: "center",
                marginLeft: "auto",
                backgroundColor:
                  saveStatus.tone === "error"
                    ? "var(--gr-status-error-bg, #fdecec)"
                    : "var(--gr-status-success-bg, #ecf8f3)",
                color:
                  saveStatus.tone === "error"
                    ? "var(--gr-error, #b00020)"
                    : "var(--gr-green-dark, #0c5132)",
                borderColor:
                  saveStatus.tone === "error"
                    ? "var(--gr-error, #b00020)"
                    : "var(--gr-green-dark, #0c5132)",
                boxShadow:
                  saveStatus.tone === "error"
                    ? "0 0 0 1px rgba(176, 0, 32, 0.08)"
                    : "0 0 0 1px rgba(12, 81, 50, 0.08)",
              }}
            >
              {saveStatus.message}
            </div>
          ) : validationError ? (
            <div
              role="status"
              aria-live="polite"
              className="text-sm font-medium px-3 py-2 rounded-md border bg-red-50 text-red-700 border-red-300"
              style={{
                minWidth: "200px",
                textAlign: "center",
                marginLeft: "auto",
              }}
            >
              {validationError}
            </div>
          ) : null}
        </div>
        {loadError ? (
          <span className="text-sm" style={{ color: "var(--gr-error, #b00020)" }}>
            {loadError}
          </span>
        ) : null}
      </div>
      <div
        className="flex flex-wrap items-center gap-4 text-sm"
        style={{
          color: "var(--gr-ink)",
          backgroundColor: "#85A63F",
          padding: "10px 14px",
          borderRadius: 0,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        }}
      >
        <button
          type="button"
          onClick={handleClearTopFilters}
          disabled={!hasTopFiltersApplied}
          style={{
            fontWeight: 600,
            fontSize: "0.8rem",
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid rgba(0, 0, 0, 0.18)",
            backgroundColor: hasTopFiltersApplied ? "var(--gr-surface)" : "rgba(255, 255, 255, 0.6)",
            color: "var(--gr-ink)",
            cursor: hasTopFiltersApplied ? "pointer" : "not-allowed",
            opacity: hasTopFiltersApplied ? 1 : 0.6,
            boxShadow: hasTopFiltersApplied ? "0 1px 4px rgba(0, 0, 0, 0.14)" : "none",
            transition: "background-color 120ms ease, opacity 120ms ease",
          }}
        >
          Reset Filters
        </button>
        <label className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          Job #
          <input
            list="tickets-job-filter-options"
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
            placeholder="All jobs"
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(0, 0, 0, 0.18)",
              backgroundColor: "var(--gr-surface)",
              color: "var(--gr-ink)",
              minWidth: 140,
            }}
          />
          <datalist id="tickets-job-filter-options">
            {jobOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          Customer #
          <input
            list="tickets-customer-filter-options"
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            placeholder="All customers"
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(0, 0, 0, 0.18)",
              backgroundColor: "var(--gr-surface)",
              color: "var(--gr-ink)",
              minWidth: 140,
            }}
          />
          <datalist id="tickets-customer-filter-options">
            {customerOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          Order #
          <input
            list="tickets-order-filter-options"
            value={orderFilter}
            onChange={(event) => setOrderFilter(event.target.value)}
            placeholder="All orders"
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(0, 0, 0, 0.18)",
              backgroundColor: "var(--gr-surface)",
              color: "var(--gr-ink)",
              minWidth: 140,
            }}
          />
          <datalist id="tickets-order-filter-options">
            {orderOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <div className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          <span>Job Name:</span>
          <span style={{ fontWeight: 700 }}>{selectedJobName || "\u2014"}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <DataGrid<TicketRow>
          columns={columns}
          rows={sortedRows}
          onRowsChange={handleRowsChange}
          rowKeyGetter={rowKeyGetter}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          defaultColumnOptions={{ resizable: true, draggable: true }}
          onColumnsReorder={handleColumnsReorder}
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

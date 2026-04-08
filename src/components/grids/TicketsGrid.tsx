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
import { usePathname } from "next/navigation";
import type { FilterInputType } from "./HeaderFilter";
import { HeaderFilter } from "./HeaderFilter";
import { DraggableCell, type DragLocation } from "./DraggableCell";
import { ToolbarMultiSelect } from "./ToolbarMultiSelect";

type AccountValidationStatus = "unknown" | "pending" | "valid" | "invalid";

type TicketRow = {
  id: string;
  UniqueID: string;
  ItemNo: string;
  VehicleID: string;
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
  ExtendedCostOverride: number | null;
  JobName: string;
  PE: string;
  PM: string;
  TicketSource: string;
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
  | "ExtendedCostOverride"
  | "acctValidationStatus"
  | "acctValidationCode"
>;

type TicketApiRow = {
  TicketNo: string | number | null;
  UniqueID: string | number | null;
  ItemNo: string | number | null;
  VehicleID: string | number | null;
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
  ExtendedCost?: number | string | null;
  JobName: string | null;
  PE?: string | null;
  PM?: string | null;
  TicketSource?: string | null;
  TicketAccountCode?: string | null;
  OnHold?: string | null;
  IsWorkingRow?: boolean | number | null;
};

type TicketsGridProps = {
  height?: number | string;
};

type DateRange = {
  from: string;
  to: string;
};

type GridColumn = Column<TicketRow, unknown>;

type TicketSource = "All" | "History" | "Pending";

function isGridColumn(column: unknown): column is GridColumn {
  if (!column || typeof column !== "object") return false;
  const candidate = column as Partial<GridColumn>;
  return (
    typeof candidate.renderCell === "function" &&
    typeof candidate.renderHeaderCell === "function" &&
    typeof candidate.name !== "undefined" &&
    typeof candidate.sortable === "boolean"
  );
}

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
const NO_PE_FOUND = "No PE Found";
const NO_PM_FOUND = "No PM Found";
const COLUMN_ORDER_STORAGE_KEY = "grc:tickets-grid-column-order";
const INVALID_ACCT_LABEL = "Invalid Acct";
const UNSAVED_ACCT_WARNING_MESSAGE =
  "You have unsaved Account Coding changes. Save before leaving?";
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

const normalizeToDayKey = (value: string | Date | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = parseDateValue(value);
  if (!parsed) return "";
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTicketDateKey = (row: TicketRow): string =>
  normalizeToDayKey(row.TicketDateTime ?? row.TicketDate);

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "";
  return currencyFormatter.format(value);
};

const formatDecimal = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "";
  return decimalFormatter.format(value);
};

const isPercentUnitCostProduct = (productId: string | null | undefined): boolean => {
  const normalized = asString(productId).toUpperCase();
  return normalized === "FSC" || normalized === "FSH";
};

const formatUnitPrice = (
  value: number | null | undefined,
  productId: string | null | undefined
): string => {
  const formatted = formatDecimal(value);
  if (!formatted) return "";
  return isPercentUnitCostProduct(productId) ? `${formatted}%` : formatCurrency(value);
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

const calculateExtendedCost = (
  qty: number | null,
  unitPrice: number | null,
  extendedCostOverride?: number | null
): number | null => {
  if (extendedCostOverride !== null && extendedCostOverride !== undefined) {
    return extendedCostOverride;
  }

  if (qty === null || unitPrice === null) {
    return null;
  }

  return qty * unitPrice;
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
  const extendedCostOverride = asNumber(record.ExtendedCost);
  const extendedCost = calculateExtendedCost(
    qtyNumber,
    unitPriceNumber,
    extendedCostOverride
  );

  const ticketNo = asString(record.TicketNo);
  const uniqueId = asString(record.UniqueID);
  const itemNo = asString(record.ItemNo);
  const peValue = asString(record.PE);
  const pmValue = asString(record.PM);
  // Build a stable, unique row key that includes the ticket number to avoid reuse after filtering.
  // TicketSource is included to disambiguate rows from different source tables (Tkbatch, Tkhist1, etc.)
  // that may share the same TicketNo/UniqueID/ItemNo.
  const ticketSource = asString(record.TicketSource);
  const rowIdParts = [ticketNo, uniqueId, itemNo, ticketSource].filter((part) => part !== "");
  const rowId =
    rowIdParts.length > 0
      ? rowIdParts.join("-")
      : `${ticketNo || "ticket"}-${index}`;

  return {
    id: rowId,
    UniqueID: uniqueId,
    ItemNo: itemNo,
    VehicleID: asString(record.VehicleID),
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
    ExtendedCostOverride: extendedCostOverride,
    JobName: asString(record.JobName),
    PE: peValue ? peValue : NO_PE_FOUND,
    PM: pmValue ? pmValue : NO_PM_FOUND,
    TicketSource: asString(record.TicketSource),
    AcctCode: asString(record.TicketAccountCode),
    TaskDesc: "",
    AcctDesc: "",
    acctValidationStatus: "unknown",
    acctValidationCode: null,
    OnHold: asNullableString(record.OnHold),
    IsWorkingRow: Boolean(record.IsWorkingRow),
  };
};

const applyAssociatedAaQtyToFscRows = (rows: TicketRow[]): TicketRow[] => {
  const aaExtendedCostByTicket = new Map<string, number>();

  rows.forEach((row) => {
    if (row.ProductID !== "AA" || row.ExtendedCost === null) {
      return;
    }

    const key = [row.TicketNo, row.UniqueID, row.TicketSource].join("|");
    if (!aaExtendedCostByTicket.has(key)) {
      aaExtendedCostByTicket.set(key, row.ExtendedCost);
    }
  });

  return rows.map((row) => {
    if (row.ProductID !== "FSC") {
      return row;
    }

    const key = [row.TicketNo, row.UniqueID, row.TicketSource].join("|");
    const associatedAaExtendedCost = aaExtendedCostByTicket.get(key);
    if (associatedAaExtendedCost === undefined) {
      return row;
    }

    return {
      ...row,
      Qty: associatedAaExtendedCost,
    };
  });
};

export default function TicketsGrid({ height = 500 }: TicketsGridProps) {
  const pathname = usePathname();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [rowsVersion, setRowsVersion] = useState(0);
  const [textFilters, setTextFilters] = useState<Partial<Record<TicketRowField, string>>>(
    {}
  );
  const [selectedFilters, setSelectedFilters] = useState<
    Partial<Record<TicketRowField, string[]>>
  >({});
  const [ticketDateRange, setTicketDateRange] = useState<DateRange>({ from: "", to: "" });
  const [jobFilters, setJobFilters] = useState<string[]>([]);
  const [customerFilters, setCustomerFilters] = useState<string[]>([]);
  const [orderFilters, setOrderFilters] = useState<string[]>([]);
  const [peFilters, setPeFilters] = useState<string[]>([]);
  const [pmFilters, setPmFilters] = useState<string[]>([]);
  const [acctCodeFilter, setAcctCodeFilter] = useState<"All" | "NoAcct" | "HasAcct">("All");
  const [ticketSource, setTicketSource] = useState<TicketSource>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasUnsavedAcctCodeChanges, setHasUnsavedAcctCodeChanges] = useState(false);
  const [showUnsavedNavDialog, setShowUnsavedNavDialog] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);
  const [, setIsValidating] = useState(false);
  const [bulkValidationSignal, setBulkValidationSignal] = useState(0);
  const autoRetrieveTriggeredRef = useRef(false);
  const baselineAcctCodeByIdRef = useRef<Map<string, string>>(new Map());
  const initialRowsValidationTriggeredRef = useRef(false);
  const pendingAcctCodeCommitRef = useRef<{ rowId: string; value: string } | null>(null);
  const lastBulkValidationScheduledRef = useRef(0);
  const currentUrlRef = useRef("");
  const allowNavigationRef = useRef(false);

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
      {
        key: "VehicleID",
        name: "Vehicle ID",
        width: 140,
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
        name: "Unit Cost",
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

  const insertMissingColumnAtDefaultPosition = useCallback(
    (current: TicketRowField[], key: TicketRowField): TicketRowField[] => {
      if (current.includes(key)) {
        return current;
      }
      const merged = [...current];
      const defaultIndex = columnKeys.indexOf(key);
      if (defaultIndex <= 0) {
        merged.unshift(key);
        return merged;
      }
      for (let idx = defaultIndex - 1; idx >= 0; idx -= 1) {
        const neighbor = columnKeys[idx];
        const neighborIndex = merged.indexOf(neighbor);
        if (neighborIndex !== -1) {
          merged.splice(neighborIndex + 1, 0, key);
          return merged;
        }
      }
      merged.unshift(key);
      return merged;
    },
    [columnKeys]
  );

  const placeColumnAfter = useCallback(
    (
      current: TicketRowField[],
      column: TicketRowField,
      anchor: TicketRowField
    ): TicketRowField[] => {
      const without = current.filter((key) => key !== column);
      const anchorIndex = without.indexOf(anchor);
      if (anchorIndex === -1) {
        return [...without, column];
      }
      const next = [...without];
      next.splice(anchorIndex + 1, 0, column);
      return next;
    },
    []
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
      let merged = [...valid];
      columnKeys.forEach((key) => {
        merged = insertMissingColumnAtDefaultPosition(merged, key);
      });
      setColumnOrder((prev) => {
        if (
          prev.length === merged.length &&
          prev.every((key, index) => key === merged[index])
        ) {
          return prev;
        }
        return placeColumnAfter(
          merged,
          "VehicleID",
          "AcctDesc"
        );
      });
    } catch {
      // ignore malformed storage
    }
  }, [columnKeySet, columnKeys, insertMissingColumnAtDefaultPosition, placeColumnAfter]);

  useEffect(() => {
    setColumnOrder((prev) => {
      const sanitized = prev.filter((key) => columnKeySet.has(key));
      const missing = columnKeys.filter((key) => !sanitized.includes(key));
      if (missing.length === 0 && sanitized.length === prev.length) {
        return prev;
      }
      const withMissing = missing.reduce(
        (acc, key) => insertMissingColumnAtDefaultPosition(acc, key),
        sanitized
      );
      return placeColumnAfter(withMissing, "VehicleID", "AcctDesc");
    });
  }, [columnKeySet, columnKeys, insertMissingColumnAtDefaultPosition, placeColumnAfter]);

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
          source: row.TicketSource,
          pe: row.PE.trim(),
          pm: row.PM.trim(),
          hasAcct: (row.AcctCode ?? "").trim() !== "",
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

  const matchesSelectedTopFilter = useCallback(
    (value: string, selectedValues: string[]) =>
      selectedValues.length === 0 || selectedValues.includes(value),
    []
  );

  const matchesNormalizedTopFilters = useCallback(
    (
      row: {
        job: string;
        customer: string;
        order: string;
        source: string;
        pe: string;
        pm: string;
        hasAcct: boolean;
      },
      ignoredFilter?: "job" | "customer" | "order" | "pe" | "pm"
    ) => {
      if (ticketSource !== "All" && row.source !== ticketSource) {
        return false;
      }
      if (acctCodeFilter === "NoAcct" && row.hasAcct) return false;
      if (acctCodeFilter === "HasAcct" && !row.hasAcct) return false;
      if (
        ignoredFilter !== "job" &&
        !matchesSelectedTopFilter(row.job, jobFilters)
      ) {
        return false;
      }
      if (
        ignoredFilter !== "customer" &&
        !matchesSelectedTopFilter(row.customer, customerFilters)
      ) {
        return false;
      }
      if (
        ignoredFilter !== "order" &&
        !matchesSelectedTopFilter(row.order, orderFilters)
      ) {
        return false;
      }
      if (
        ignoredFilter !== "pe" &&
        !matchesSelectedTopFilter(row.pe, peFilters)
      ) {
        return false;
      }
      if (
        ignoredFilter !== "pm" &&
        !matchesSelectedTopFilter(row.pm, pmFilters)
      ) {
        return false;
      }
      return true;
    },
    [
      ticketSource,
      acctCodeFilter,
      matchesSelectedTopFilter,
      jobFilters,
      customerFilters,
      orderFilters,
      peFilters,
      pmFilters,
    ]
  );

  const jobOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (!matchesNormalizedTopFilters(row, "job")) return;
      if (row.job) {
        set.add(row.job);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, matchesNormalizedTopFilters]);

  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (!matchesNormalizedTopFilters(row, "customer")) return;
      if (row.customer) {
        set.add(row.customer);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, matchesNormalizedTopFilters]);

  const orderOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (!matchesNormalizedTopFilters(row, "order")) return;
      if (row.order) {
        set.add(row.order);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, matchesNormalizedTopFilters]);

  const peOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (!matchesNormalizedTopFilters(row, "pe")) return;
      if (row.pe) {
        set.add(row.pe);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, matchesNormalizedTopFilters]);

  const pmOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((row) => {
      if (!matchesNormalizedTopFilters(row, "pm")) return;
      if (row.pm) {
        set.add(row.pm);
      }
    });
    return Array.from(set).sort(collator.compare);
  }, [normalizedRows, collator, matchesNormalizedTopFilters]);

  const selectedJobName =
    jobFilters.length === 1
      ? jobNameLookup.get(jobFilters[0]) ?? ""
      : jobFilters.length > 1
      ? `${jobFilters.length} jobs selected`
      : "";

  const matchesTopLevelFilters = useCallback(
    (row: TicketRow) => {
      if (!matchesSelectedTopFilter(row.JobNumber.trim(), jobFilters)) {
        return false;
      }
      if (!matchesSelectedTopFilter(row.CustomerID.trim(), customerFilters)) {
        return false;
      }
      if (!matchesSelectedTopFilter(row.OrderID.trim(), orderFilters)) {
        return false;
      }
      if (!matchesSelectedTopFilter(row.PE, peFilters)) {
        return false;
      }
      if (!matchesSelectedTopFilter(row.PM, pmFilters)) {
        return false;
      }
      if (ticketSource !== "All" && row.TicketSource !== ticketSource) {
        return false;
      }
      if (acctCodeFilter !== "All") {
        const hasAcct = (row.AcctCode ?? "").trim() !== "";
        if (acctCodeFilter === "NoAcct" && hasAcct) return false;
        if (acctCodeFilter === "HasAcct" && !hasAcct) return false;
      }
      return true;
    },
    [
      matchesSelectedTopFilter,
      jobFilters,
      customerFilters,
      orderFilters,
      peFilters,
      pmFilters,
      ticketSource,
      acctCodeFilter,
    ]
  );

  const matchesTicketDateRange = useCallback(
    (row: TicketRow) => {
      const from = ticketDateRange.from;
      const to = ticketDateRange.to;
      if (!from && !to) return true;
      const dateKey = getTicketDateKey(row);
      if (!dateKey) return false;
      if (from && !to) return dateKey === from;
      if (!from && to) return dateKey <= to;
      return dateKey >= from && dateKey <= to;
    },
    [ticketDateRange.from, ticketDateRange.to]
  );

  const matchesFilterValue = useCallback(
    (
      row: TicketRow,
      key: TicketRowField,
      filterValue: string,
      mode: "contains" | "exact"
    ): boolean => {
      const normalizedFilter = filterValue.trim().toLowerCase();
      if (!normalizedFilter) return true;

      if (key === "AcctCode" && normalizedFilter === NO_ACCT_FILTER_VALUE_NORMALIZED) {
        const rawValue = row[key];
        const normalizedValue =
          rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();
        return normalizedValue === "";
      }

      const cellValue = row[key];
      if (cellValue === undefined || cellValue === null) return false;

      const candidate =
        key === "Qty"
          ? formatDecimal(cellValue as number)
          : key === "UnitPrice"
          ? formatUnitPrice(cellValue as number, row.ProductID)
          : String(cellValue).trim();
      if (dateColumns.has(key) || mode === "exact") {
        return candidate.toLowerCase() === normalizedFilter;
      }

      return candidate.toLowerCase().includes(normalizedFilter);
    },
    [dateColumns]
  );

  const matchesColumnFilters = useCallback(
    (
      row: TicketRow,
      key: TicketRowField,
      textFilter: string | undefined,
      selectedValues: string[] | undefined
    ): boolean => {
      const normalizedSelections =
        selectedValues?.filter((value) => value.trim() !== "") ?? [];
      if (
        normalizedSelections.length > 0 &&
        !normalizedSelections.some((value) =>
          matchesFilterValue(row, key, value, "exact")
        )
      ) {
        return false;
      }

      if (textFilter && !matchesFilterValue(row, key, textFilter, "contains")) {
        return false;
      }

      return true;
    },
    [matchesFilterValue]
  );

  const columnOptions = useMemo(() => {
    const activeFilterKeys = columnKeys.filter((key) => {
      const textValue = textFilters[key];
      const selectedValues = selectedFilters[key];
      return Boolean(textValue?.trim()) || Boolean(selectedValues?.length);
    });

    const baseRows = rows.filter(
      (row) => matchesTopLevelFilters(row) && matchesTicketDateRange(row)
    );

    const optionsMap = new Map<TicketRowField, string[]>();

    columnKeys.forEach((columnKey) => {
      const otherFilterKeys = activeFilterKeys.filter((key) => key !== columnKey);

      const relevantRows =
        otherFilterKeys.length === 0
          ? baseRows
          : baseRows.filter((row) =>
              otherFilterKeys.every((key) =>
                matchesColumnFilters(row, key, textFilters[key], selectedFilters[key])
              )
            );

      const valueSet = new Set<string>();
      let includeNoAcctOption = false;
      relevantRows.forEach((row) => {
        const value = row[columnKey];
        const normalizedValue =
          value === undefined || value === null
            ? ""
            : columnKey === "Qty"
            ? formatDecimal(value as number)
            : columnKey === "UnitPrice"
            ? formatUnitPrice(value as number, row.ProductID)
            : String(value).trim();
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
  }, [
    rows,
    columnKeys,
    textFilters,
    selectedFilters,
    collator,
    matchesTopLevelFilters,
    matchesTicketDateRange,
    matchesColumnFilters,
  ]);

  const filteredRows = useMemo(() => {
    const rowsWithTopLevelFilters = rows.filter(
      (row) => matchesTopLevelFilters(row) && matchesTicketDateRange(row)
    );

    const hasColumnFilters = columnKeys.some((key) => {
      const textValue = textFilters[key];
      const selectedValues = selectedFilters[key];
      return Boolean(textValue?.trim()) || Boolean(selectedValues?.length);
    });

    if (!hasColumnFilters) return rowsWithTopLevelFilters;
    return rowsWithTopLevelFilters.filter((row) =>
      columnKeys.every((key) =>
        matchesColumnFilters(row, key, textFilters[key], selectedFilters[key])
      )
    );
  }, [
    rows,
    columnKeys,
    textFilters,
    selectedFilters,
    matchesTopLevelFilters,
    matchesTicketDateRange,
    matchesColumnFilters,
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

  const gridInstanceKey = useMemo(() => `rows-${rowsVersion}`, [rowsVersion]);

  const rowKeyGetter = useCallback((row: TicketRow) => row.id, []);

  const visibleRowKeys = useMemo(
    () => sortedRows.map((row) => rowKeyGetter(row)),
    [sortedRows, rowKeyGetter]
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
    setTextFilters({});
    setSelectedFilters({});
    setTicketDateRange({ from: "", to: "" });
    setSortColumns([]);
    setSaveError(null);
    setSaveMessage(null);
    setValidationError(null);
    setTicketSource("All");
    setAcctCodeFilter("All");
    setJobFilters([]);
    setCustomerFilters([]);
    setOrderFilters([]);
    setPeFilters([]);
    setPmFilters([]);
  }, []);

  const handleClearTopFilters = useCallback(() => {
    setJobFilters([]);
    setCustomerFilters([]);
    setOrderFilters([]);
    setPeFilters([]);
    setPmFilters([]);
    setTicketSource("All");
    setAcctCodeFilter("All");
  }, []);

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
    (jobFilters.length > 0 ? 1 : 0) +
    (customerFilters.length > 0 ? 1 : 0) +
    (orderFilters.length > 0 ? 1 : 0) +
    (peFilters.length > 0 ? 1 : 0) +
    (pmFilters.length > 0 ? 1 : 0) +
    (ticketSource !== "All" ? 1 : 0) +
    (acctCodeFilter !== "All" ? 1 : 0);
  const hasTopFiltersApplied = topLevelFilterCount > 0;
  const hasTicketDateRange = Boolean(ticketDateRange.from || ticketDateRange.to);
  const activeFilterCount =
    Object.keys(textFilters).length +
    Object.keys(selectedFilters).length +
    topLevelFilterCount +
    (hasTicketDateRange ? 1 : 0);
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

  const handleTextFilterChange = useCallback(
    (key: TicketRowField, value: string) => {
      setTextFilters((prev) => {
        const next = { ...prev };
        if (value.trim()) {
          next[key] = value;
        } else {
          delete next[key];
        }
        return next;
      });
    },
    []
  );

  const handleSelectedFilterChange = useCallback(
    (key: TicketRowField, values: string[]) => {
      setSelectedFilters((prev) => {
        const normalizedValues = Array.from(
          new Set(values.map((value) => value.trim()).filter((value) => value !== ""))
        );
        const next = { ...prev };
        if (normalizedValues.length > 0) {
          next[key] = normalizedValues;
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

        const isTicketDateColumn = columnKey === "TicketDate";
        const inputType: FilterInputType = isTicketDateColumn
          ? "date-range"
          : dateColumns.has(columnKey)
          ? "date"
          : numericColumns.has(columnKey)
          ? "number"
          : "text";
        const sortEntry = sortColumns.find((entry) => entry.columnKey === columnKey);

        return {
          ...column,
          sortable: Boolean(column.sortable),
          renderHeaderCell: () => (
            <HeaderFilter
              label={String(column.name)}
              value={textFilters[columnKey] ?? ""}
              selectedValues={selectedFilters[columnKey] ?? []}
              type={inputType}
              rangeValue={isTicketDateColumn ? ticketDateRange : undefined}
              onRangeChange={isTicketDateColumn ? setTicketDateRange : undefined}
              options={columnOptions.get(columnKey)}
              onChange={(value) => handleTextFilterChange(columnKey, value)}
              onSelectedValuesChange={(values) =>
                handleSelectedFilterChange(columnKey, values)
              }
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
            const isRightAlignedColumn =
              columnKey === "Qty" ||
              columnKey === "UnitPrice" ||
              columnKey === "ExtendedCost";
            const isValidationColumn =
              isAcctColumn || isTaskDescColumn || isAcctDescColumn;

            const renderValue =
              columnKey === "TicketDate"
                ? () => cellProps.row.TicketDateDisplay ?? ""
                : columnKey === "Qty"
                ? () => formatDecimal(cellProps.row.Qty)
                : columnKey === "UnitPrice"
                ? () => formatUnitPrice(cellProps.row.UnitPrice, cellProps.row.ProductID)
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
            if (isRightAlignedColumn) {
              extraClasses.push("rdg-draggable-cell-right");
            }
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
        } as Column<TicketRow, unknown>;
      })
      .filter(isGridColumn);
  }, [
    baseColumnMap,
    columnOptions,
    dateColumns,
    textFilters,
    selectedFilters,
    handleCellValueDrop,
    handleSelectedFilterChange,
    handleTextFilterChange,
    numericColumns,
    ticketDateRange,
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
          const nextRow = {
            ...existingRow,
            ...row,
            ExtendedCost: calculateExtendedCost(
              row.Qty,
              row.UnitPrice,
              existingRow.ExtendedCostOverride
            ),
          };

          if (normalized.length === 0) {
            updatedMap.set(key, {
                ...nextRow,
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
                ...nextRow,
                AcctCode: normalized,
                TaskDesc: "",
                AcctDesc: "",
                acctValidationStatus: "unknown",
              acctValidationCode: normalized,
            });
            return;
          }

          updatedMap.set(key, nextRow);
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

      const mapped = applyAssociatedAaQtyToFscRows(
        data.rows.map((record, index) => toTicketRow(record, index))
      );
      setRows(mapped);
      setRowsVersion((prev) => prev + 1);
      setTextFilters({});
      setSelectedFilters({});
      setTicketDateRange({ from: "", to: "" });
      setJobFilters([]);
      setCustomerFilters([]);
      setOrderFilters([]);
      setPeFilters([]);
      setPmFilters([]);
      setTicketSource("All");
      setAcctCodeFilter("All");
      setSaveMessage(null);
      baselineAcctCodeByIdRef.current = new Map(
        mapped.map((row) => [row.id, normalizeAccountCode(row.AcctCode ?? "")])
      );
      setHasUnsavedAcctCodeChanges(false);

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

  useEffect(() => {
    if (autoRetrieveTriggeredRef.current) {
      return;
    }
    autoRetrieveTriggeredRef.current = true;
    void handleRetrieve();
  }, [handleRetrieve]);

  useEffect(() => {
    currentUrlRef.current = typeof window === "undefined" ? "" : window.location.href;
  }, [pathname]);

  useEffect(() => {
    if (rows.length === 0 && baselineAcctCodeByIdRef.current.size === 0) {
      setHasUnsavedAcctCodeChanges(false);
      return;
    }

    const baseline = baselineAcctCodeByIdRef.current;
    const hasDirtyRow = rows.some((row) => {
      const baselineCode = baseline.get(row.id) ?? "";
      const currentCode = normalizeAccountCode(row.AcctCode ?? "");
      return baselineCode !== currentCode;
    });
    setHasUnsavedAcctCodeChanges(hasDirtyRow);
  }, [rows]);

  useEffect(() => {
    if (!hasUnsavedAcctCodeChanges || typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      let target = event.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }
      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigationUrl(destination.href);
      setShowUnsavedNavDialog(true);
    };

    const handlePopState = (event: PopStateEvent) => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }

      const destination = window.location.href;
      event.preventDefault();
      if (currentUrlRef.current) {
        window.history.pushState(null, "", currentUrlRef.current);
      }
      setPendingNavigationUrl(destination);
      setShowUnsavedNavDialog(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedAcctCodeChanges]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!hasSaveableRows) {
      setSaveError("No rows with an account code to save.");
      setSaveMessage(null);
      return false;
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
      return false;
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
      baselineAcctCodeByIdRef.current = new Map(
        rows.map((row) => [row.id, normalizeAccountCode(row.AcctCode ?? "")])
      );
      setHasUnsavedAcctCodeChanges(false);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save ticket data.";
      setSaveError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [rows, hasSaveableRows]);

  const handleStayOnPage = useCallback(() => {
    setShowUnsavedNavDialog(false);
    setPendingNavigationUrl(null);
  }, []);

  const handleLeaveWithoutSaving = useCallback(() => {
    const destination = pendingNavigationUrl;
    setShowUnsavedNavDialog(false);
    setPendingNavigationUrl(null);
    if (!destination || typeof window === "undefined") {
      return;
    }
    allowNavigationRef.current = true;
    window.location.href = destination;
  }, [pendingNavigationUrl]);

  const handleSaveAndLeave = useCallback(async () => {
    const destination = pendingNavigationUrl;
    if (!destination) {
      handleStayOnPage();
      return;
    }
    const saved = await handleSave();
    if (!saved) {
      return;
    }
    if (typeof window !== "undefined") {
      allowNavigationRef.current = true;
      window.location.href = destination;
    }
  }, [handleSave, handleStayOnPage, pendingNavigationUrl]);

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
      {showUnsavedNavDialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-acct-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
        >
          <div
            className="w-full max-w-lg rounded-md border shadow-lg"
            style={{
              backgroundColor: "var(--gr-surface, #ffffff)",
              borderColor: "rgba(0, 0, 0, 0.12)",
            }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(0, 0, 0, 0.12)" }}>
              <h2 id="unsaved-acct-dialog-title" className="text-base font-semibold">
                Unsaved changes
              </h2>
            </div>
            <div className="px-5 py-4 text-sm" style={{ color: "var(--gr-ink)" }}>
              {UNSAVED_ACCT_WARNING_MESSAGE}
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={handleStayOnPage}
                disabled={isSaving}
                className="px-4 py-2 rounded-md font-medium"
                style={{
                  ...toolbarButtonBaseStyles,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleLeaveWithoutSaving}
                disabled={isSaving}
                className="px-4 py-2 rounded-md font-medium"
                style={{
                  ...toolbarButtonBaseStyles,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                Leave Without Saving
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndLeave()}
                disabled={isSaving}
                className="px-4 py-2 rounded-md font-medium"
                style={{
                  ...toolbarButtonBaseStyles,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? "Saving..." : "Save & Leave"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
        <ToolbarMultiSelect
          label="Job #"
          options={jobOptions}
          selectedValues={jobFilters}
          onChange={setJobFilters}
          placeholder="All jobs"
          minWidth={140}
        />
        <ToolbarMultiSelect
          label="Customer #"
          options={customerOptions}
          selectedValues={customerFilters}
          onChange={setCustomerFilters}
          placeholder="All customers"
          minWidth={140}
        />
        <ToolbarMultiSelect
          label="Order #"
          options={orderOptions}
          selectedValues={orderFilters}
          onChange={setOrderFilters}
          placeholder="All orders"
          minWidth={140}
        />
        <ToolbarMultiSelect
          label="PE"
          options={peOptions}
          selectedValues={peFilters}
          onChange={setPeFilters}
          placeholder="All PEs"
          minWidth={160}
        />
        <ToolbarMultiSelect
          label="PM"
          options={pmOptions}
          selectedValues={pmFilters}
          onChange={setPmFilters}
          placeholder="All PMs"
          minWidth={160}
        />
        <div className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          <span>Acct Code:</span>
          <select
            value={acctCodeFilter}
            onChange={(e) => setAcctCodeFilter(e.target.value as "All" | "NoAcct" | "HasAcct")}
            style={{
              fontSize: "0.8rem",
              fontWeight: acctCodeFilter !== "All" ? 600 : 500,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(0, 0, 0, 0.18)",
              backgroundColor: "var(--gr-surface)",
              color: "var(--gr-ink)",
              minWidth: 120,
              cursor: "pointer",
            }}
          >
            <option value="All">All</option>
            <option value="NoAcct">No Acct</option>
            <option value="HasAcct">Has Acct</option>
          </select>
        </div>
        <div className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          <span>Ticket Source:</span>
          <label className="flex items-center gap-1" style={{ fontWeight: 500 }}>
            <input
              type="radio"
              name="ticket-source"
              value="All"
              checked={ticketSource === "All"}
              onChange={() => setTicketSource("All")}
            />
            All
          </label>
          <label className="flex items-center gap-1" style={{ fontWeight: 500 }}>
            <input
              type="radio"
              name="ticket-source"
              value="History"
              checked={ticketSource === "History"}
              onChange={() => setTicketSource("History")}
            />
            History
          </label>
          <label className="flex items-center gap-1" style={{ fontWeight: 500 }}>
            <input
              type="radio"
              name="ticket-source"
              value="Pending"
              checked={ticketSource === "Pending"}
              onChange={() => setTicketSource("Pending")}
            />
            Pending
          </label>
        </div>
        <div className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          <span>Job Name:</span>
          <span style={{ fontWeight: 700 }}>{selectedJobName || "\u2014"}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <DataGrid<TicketRow>
          key={gridInstanceKey}
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
          headerRowHeight={80}
          style={gridStyle}
        />
      </div>
    </div>
  );
}

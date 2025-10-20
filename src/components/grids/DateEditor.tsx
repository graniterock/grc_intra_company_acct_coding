"use client";

import type { RenderEditCellProps } from "react-data-grid";

/**
 * Date editor that keeps the grid value in ISO (yyyy-MM-dd) format while
 * providing a native datepicker UI.
 */
function normalizeDateValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return "";
}

export function DateEditor<R extends Record<string, unknown>>({
  row,
  column,
  onRowChange,
}: RenderEditCellProps<R>) {
  const key = column.key as keyof R;
  const currentValue = row[key];
  const stringValue = normalizeDateValue(currentValue);

  const commit = (nextValue: string) => {
    onRowChange(
      {
        ...row,
        [key]: (nextValue as unknown) as R[typeof key],
      },
      true
    );
  };

  return (
    <input
      autoFocus
      type="date"
      value={stringValue}
      onChange={(event) => commit(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
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


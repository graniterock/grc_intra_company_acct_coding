"use client";

import type { RenderEditCellProps } from "react-data-grid";

/**
 * Basic text editor used for editable grid columns.
 */
export function TextEditor<R extends Record<string, unknown>>({
  row,
  column,
  onRowChange,
}: RenderEditCellProps<R>) {
  const key = column.key as keyof R;
  const value = row[key] as unknown as string | undefined;

  const commit = (next: string) => {
    onRowChange(
      {
        ...row,
        [key]: (next as unknown) as R[typeof key],
      },
      true
    );
  };

  return (
    <input
      autoFocus
      type="text"
      value={value ?? ""}
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


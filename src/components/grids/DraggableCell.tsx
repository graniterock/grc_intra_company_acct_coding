"use client";

import type { DragEvent, ReactNode } from "react";
import type { RenderCellProps } from "react-data-grid";

const DRAG_MIME_TYPE = "application/x-grc-grid-cell";

type DragLocation = {
  columnKey: string;
  columnIndex: number;
  rowKey: string;
};

type DraggableCellProps<R> = RenderCellProps<R> & {
  rowKey: string;
  columnIndex: number;
  onDropValue: (source: DragLocation, target: DragLocation) => void;
  renderValue?: (value: unknown) => ReactNode;
  canDrag?: boolean;
  canDrop?: boolean;
};

/**
 * Wraps a default RDG cell with HTML drag-and-drop so the value can be copied
 * between arbitrary cells. Consumers update the underlying row data in
 * `onDropValue`.
 */
export function DraggableCell<R>({
  column,
  row,
  rowKey,
  columnIndex,
  onDropValue,
  renderValue,
  canDrag = true,
  canDrop = true,
}: DraggableCellProps<R>) {
  const columnKey = String(column.key);
  const cellValue = (row as Record<string, unknown>)[columnKey];

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      DRAG_MIME_TYPE,
      JSON.stringify({ columnKey, columnIndex, rowKey })
    );
    // Provide a basic fallback so the payload is visible in devtools.
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ columnKey, columnIndex, rowKey })
    );
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canDrop || !event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canDrop || !event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
    event.preventDefault();

    try {
      const payload = JSON.parse(
        event.dataTransfer.getData(DRAG_MIME_TYPE)
      ) as DragLocation;

      if (
        payload.columnKey === columnKey &&
        payload.rowKey === rowKey
      ) {
        return;
      }

      onDropValue(payload, { columnKey, columnIndex, rowKey });
    } catch {
      // ignore malformed payloads
    }
  };

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="rdg-draggable-cell"
      title={canDrag ? "Drag to copy this value into another cell" : undefined}
    >
      {renderValue ? renderValue(cellValue) : formatValue(cellValue)}
    </div>
  );
}

function formatValue(value: unknown): ReactNode {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

export type { DragLocation, DraggableCellProps };

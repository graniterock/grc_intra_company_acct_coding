"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type HeaderFilterProps = {
  label: string;
  value?: string;
  type: FilterInputType;
  options?: string[];
  onChange: (value: string) => void;
  onLabelClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  sortDirection?: "ASC" | "DESC" | null;
};

type FilterInputType = "text" | "number" | "date";

export type { FilterInputType };

export function HeaderFilter({
  label,
  value,
  type,
  options,
  onChange,
  onLabelClick,
  sortDirection,
}: HeaderFilterProps) {
  const normalizedValue = value ?? "";
  const optionList = useMemo(
    () => options?.filter((option) => option !== "") ?? [],
    [options]
  );
  const hasOptions = optionList.length > 0;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setAnchorRect(rect);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !containerRef.current?.contains(target) &&
        !overlayRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickAway);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("mousedown", handleClickAway);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const handleToggleDropdown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        updatePosition();
      }
      return next;
    });
  };

  const handleLabelClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onLabelClick?.(event);
  };

  const handleSelectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <label
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "0.75rem",
        color: "var(--gr-ink)",
        fontWeight: 600,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
        }}
      >
        <button
          type="button"
          onClick={handleLabelClick}
          aria-label={`Sort by ${label}`}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--gr-ink)",
            fontWeight: 600,
            fontSize: "0.75rem",
            padding: 0,
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            cursor: onLabelClick ? "pointer" : "default",
          }}
        >
          <span>{label}</span>
          {sortDirection ? (
            <span aria-hidden="true">{sortDirection === "ASC" ? "\u25B2" : "\u25BC"}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={handleToggleDropdown}
          onPointerDown={handlePointerDown}
          aria-label={`Show filters for ${label}`}
          style={{
            appearance: "none",
            border: "1px solid rgba(0, 0, 0, 0.18)",
            backgroundColor: "var(--gr-surface)",
            color: "var(--gr-ink)",
            borderRadius: 4,
            padding: "2px 4px",
            fontSize: "0.7rem",
            cursor: hasOptions ? "pointer" : "default",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {"\u25BC"}
        </button>
      </div>
      {isOpen &&
        anchorRect &&
        createPortal(
          <div
            ref={(node) => {
              overlayRef.current = node;
            }}
            style={{
              position: "fixed",
              top: anchorRect.bottom + 4,
              left: Math.max(
                8,
                Math.min(
                  anchorRect.left,
                  window.innerWidth - 180
                )
              ),
              minWidth: Math.max(anchorRect.width, 160),
              maxHeight: 220,
              overflowY: "auto",
              backgroundColor: "var(--gr-surface)",
              border: "1px solid rgba(0, 0, 0, 0.2)",
              borderRadius: 6,
              boxShadow: "0 12px 24px rgba(0, 0, 0, 0.16)",
              zIndex: 1000,
              padding: "4px 0",
            }}
          >
            <button
              type="button"
              onClick={handleClear}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                textAlign: "left",
                padding: "6px 12px",
                fontSize: "0.75rem",
                color: "var(--gr-ink)",
                cursor: "pointer",
                fontWeight: normalizedValue === "" ? 600 : 400,
              }}
            >
              All values
            </button>
            <div
              style={{
                margin: "4px 0",
                height: 1,
                backgroundColor: "rgba(0,0,0,0.1)",
              }}
            />
            {optionList.length === 0 ? (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: "0.75rem",
                  color: "rgba(0, 0, 0, 0.55)",
                }}
              >
                No values available
              </div>
            ) : (
              optionList.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    padding: "6px 12px",
                    fontSize: "0.75rem",
                    color: "var(--gr-ink)",
                    cursor: "pointer",
                    fontWeight: normalizedValue === option ? 600 : 400,
                  }}
                >
                  {option}
                </button>
              ))
            )}
          </div>,
          document.body
      )}
      <input
        type={type}
        value={normalizedValue}
        onChange={handleInputChange}
        onPointerDown={handlePointerDown}
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          padding: "4px 6px",
          borderRadius: 6,
          border: "1px solid rgba(0, 0, 0, 0.18)",
          backgroundColor: "var(--gr-surface)",
          color: "var(--gr-ink)",
        }}
      />
    </label>
  );
}

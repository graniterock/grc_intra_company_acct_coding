"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type ToolbarMultiSelectProps = {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  minWidth?: number;
};

export function ToolbarMultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  minWidth = 160,
}: ToolbarMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const optionList = useMemo(
    () => options.filter((option) => option.trim() !== ""),
    [options]
  );

  const updatePosition = () => {
    if (!containerRef.current) return;
    setAnchorRect(containerRef.current.getBoundingClientRect());
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

  const handleToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        updatePosition();
      }
      return next;
    });
  };

  const handleToggleOption = (option: string) => {
    const nextValues = selectedValues.includes(option)
      ? selectedValues.filter((value) => value !== option)
      : [...selectedValues, option];
    onChange(nextValues);
  };

  const handleClear = () => {
    onChange([]);
    setIsOpen(false);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const buttonText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length <= 2
      ? selectedValues.join(", ")
      : `${selectedValues.length} selected`;

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2"
      style={{ fontWeight: 600, position: "relative" }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        onPointerDown={handlePointerDown}
        style={{
          fontSize: "0.8rem",
          fontWeight: selectedValues.length > 0 ? 600 : 500,
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid rgba(0, 0, 0, 0.18)",
          backgroundColor: "var(--gr-surface)",
          color: "var(--gr-ink)",
          minWidth,
          maxWidth: 220,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          textAlign: "left",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {buttonText}
        </span>
        <span aria-hidden="true" style={{ flexShrink: 0 }}>
          {selectedValues.length > 0 ? `(${selectedValues.length}) ` : ""}
          {"\u25BC"}
        </span>
      </button>
      {isOpen && anchorRect
        ? createPortal(
            <div
              ref={(node) => {
                overlayRef.current = node;
              }}
              style={{
                position: "fixed",
                top: anchorRect.bottom + 4,
                left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - 240)),
                minWidth: Math.max(anchorRect.width, minWidth),
                maxHeight: 260,
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
                  fontWeight: selectedValues.length === 0 ? 600 : 400,
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
                    onClick={() => handleToggleOption(option)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: "0.75rem",
                      color: "var(--gr-ink)",
                      cursor: "pointer",
                      fontWeight: selectedValues.includes(option) ? 600 : 400,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span aria-hidden="true">
                      {selectedValues.includes(option) ? "\u2611" : "\u2610"}
                    </span>
                    <span>{option}</span>
                  </button>
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

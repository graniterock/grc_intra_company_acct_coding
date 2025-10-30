"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import TicketsGrid from "../../components/grids/TicketsGrid";
import OrdersGrid from "../../components/grids/OrdersGrid";

const BUTTON_BASE =
  "px-5 py-2.5 text-[1.09375rem] font-medium border rounded-md transition-colors";

export default function CodingGridSwitcher() {
  const [active, setActive] = useState<"tickets" | "orders">("tickets");
  const [gridHeight, setGridHeight] = useState<number>(600);
  const gridShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (!gridShellRef.current) return;
      const rect = gridShellRef.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 24; // subtract page padding
      setGridHeight(Math.max(available, 320));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const renderButton = (label: string, key: "tickets" | "orders") => {
    const selected = active === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setActive(key)}
        className={BUTTON_BASE}
        style={{
          backgroundColor: selected
            ? "var(--gr-lime)"
            : "color-mix(in srgb, var(--gr-lime) 65%, white)",
          borderColor: selected
            ? "color-mix(in srgb, var(--gr-lime) 70%, black)"
            : "color-mix(in srgb, var(--gr-lime) 45%, white)",
          color: "#000000",
        }}
      >
        {label}
      </button>
    );
  };

  const framePadding = 16;

  const frameStyle: CSSProperties & { ["--rdg-border-color"]?: string } = {
    backgroundColor: "var(--gr-grey-5)",
    padding: `${framePadding}px`,
    "--rdg-border-color": "color-mix(in srgb, var(--gr-grey-5) 45%, white)",
  };

  const viewLabel = active === "tickets" ? "Tickets" : "Orders";

  return (
    <section className="flex flex-col flex-1 min-h-0 gap-4 w-full">
      <div
        className="flex flex-wrap items-center gap-3 w-full"
        style={{
          paddingLeft: `${framePadding}px`,
          paddingRight: `${framePadding}px`,
        }}
      >
        <div className="flex flex-wrap gap-2">
          {renderButton("Tickets", "tickets")}
          {renderButton("Orders", "orders")}
        </div>
        <div className="flex-1 flex justify-center">
          <div
            style={{
              color: "#000000",
              fontWeight: 700,
              fontSize: "1.85rem",
              lineHeight: 1.1,
              textAlign: "center",
              minWidth: "fit-content",
            }}
          >
            {viewLabel}
          </div>
        </div>
      </div>
      <div
        className="flex flex-col flex-1 min-h-0 h-full w-full rounded-xl shadow-md"
        style={frameStyle}
      >
        <div
          ref={gridShellRef}
          className="flex-1 min-h-0 h-full w-full rounded-lg overflow-hidden"
          style={{
            backgroundColor: "var(--gr-surface)",
          }}
        >
          {active === "tickets" ? (
            <TicketsGrid height={gridHeight} />
          ) : (
            <OrdersGrid height={gridHeight} />
          )}
        </div>
      </div>
    </section>
  );
}

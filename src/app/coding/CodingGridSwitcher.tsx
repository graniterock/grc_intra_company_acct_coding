"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import TicketsGrid from "../../components/grids/TicketsGrid";
import OrdersGrid from "../../components/grids/OrdersGrid";

const BUTTON_BASE =
  "px-4 py-2 text-sm font-medium border rounded-md transition-colors";

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

  const frameStyle: CSSProperties & { ["--rdg-border-color"]?: string } = {
    backgroundColor: "color-mix(in srgb, var(--gr-grey-5) 45%, white)",
    padding: "16px",
    "--rdg-border-color": "color-mix(in srgb, var(--gr-grey-5) 45%, white)",
  };

  return (
    <section className="flex flex-col flex-1 min-h-0 gap-4 w-full">
      <div className="flex flex-wrap gap-2">
        {renderButton("Tickets", "tickets")}
        {renderButton("Orders", "orders")}
      </div>
      <div
        className="flex flex-col flex-1 min-h-0 h-full w-full rounded-xl shadow-md"
        style={frameStyle}
      >
        <div
          style={{
            color: "#000000",
            fontWeight: 600,
            fontSize: "1.235rem",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          {active === "tickets" ? "Tickets" : "Orders"}
        </div>
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

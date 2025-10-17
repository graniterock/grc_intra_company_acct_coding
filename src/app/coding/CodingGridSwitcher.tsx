"use client";

import { useEffect, useRef, useState } from "react";

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
          backgroundColor: selected ? "var(--gr-primary)" : "transparent",
          borderColor: selected ? "var(--gr-primary)" : "var(--gr-line)",
          color: selected ? "var(--gr-background)" : "var(--gr-ink)",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <section className="flex flex-col flex-1 min-h-0 gap-4 w-full">
      <div className="flex flex-wrap gap-2">
        {renderButton("Tickets", "tickets")}
        {renderButton("Orders", "orders")}
      </div>
      <div ref={gridShellRef} className="flex-1 min-h-0 h-full w-full">
        {active === "tickets" ? (
          <TicketsGrid height={gridHeight} />
        ) : (
          <OrdersGrid height={gridHeight} />
        )}
      </div>
    </section>
  );
}

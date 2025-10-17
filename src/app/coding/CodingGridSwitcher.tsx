"use client";

import { useState } from "react";

import TicketsGrid from "../../components/grids/TicketsGrid";
import OrdersGrid from "../../components/grids/OrdersGrid";

const BUTTON_BASE =
  "px-4 py-2 text-sm font-medium border rounded-md transition-colors";

export default function CodingGridSwitcher() {
  const [active, setActive] = useState<"tickets" | "orders">("tickets");

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
    <section className="space-y-4">
      <div className="flex gap-2">
        {renderButton("Tickets", "tickets")}
        {renderButton("Orders", "orders")}
      </div>
      {active === "tickets" ? <TicketsGrid /> : <OrdersGrid />}
    </section>
  );
}

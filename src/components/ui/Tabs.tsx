"use client";

import { useState } from "react";

export function Tabs({
  labels,
  children,
}: {
  labels: string[];
  children: React.ReactNode[];
}) {
  const [i, setI] = useState(0);
  return (
    <section>
      <div
        className="flex gap-2 border-b"
        style={{ borderColor: "var(--gr-line)" }}
      >
        {labels.map((label, idx) => (
          <button
            key={label}
            onClick={() => setI(idx)}
            className={`px-4 py-2 text-sm font-medium ${
              i === idx ? "border-b-2" : "opacity-70"
            }`}
            style={{
              color: "var(--gr-ink)",
              borderColor: i === idx ? "var(--gr-primary)" : "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pt-4">{children[i]}</div>
    </section>
  );
}

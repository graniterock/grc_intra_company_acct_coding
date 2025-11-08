"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import TicketsGrid from "../../components/grids/TicketsGrid";

export default function CodingGridSwitcher() {
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

  const framePadding = 16;

  const frameStyle: CSSProperties & { ["--rdg-border-color"]?: string } = {
    backgroundColor: "var(--gr-grey-5)",
    padding: `${framePadding}px`,
    "--rdg-border-color": "color-mix(in srgb, var(--gr-grey-5) 45%, white)",
  };

  return (
    <section className="flex flex-col flex-1 min-h-0 gap-4 w-full">
      <div
        className="flex items-center justify-center w-full"
        style={{
          paddingLeft: `${framePadding}px`,
          paddingRight: `${framePadding}px`,
        }}
      >
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
          Tickets
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
          <TicketsGrid height={gridHeight} />
        </div>
      </div>
    </section>
  );
}

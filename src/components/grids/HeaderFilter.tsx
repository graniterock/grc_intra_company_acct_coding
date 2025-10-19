"use client";

type FilterInputType = "text" | "number" | "date";

export type { FilterInputType };

type HeaderFilterProps = {
  label: string;
  value?: string;
  type: FilterInputType;
  onChange: (value: string) => void;
};

export function HeaderFilter({ label, value, type, onChange }: HeaderFilterProps) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "0.75rem",
        color: "var(--gr-ink)",
        fontWeight: 600,
      }}
    >
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
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

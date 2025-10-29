import CodingGridSwitcher from "./CodingGridSwitcher";

export const metadata = {
  title: "Intra-Company Coding | Graniterock",
};

export default function CodingPage() {
  return (
    <main
      className="w-full px-6 py-6 space-y-6 min-h-screen flex flex-col"
      style={{
        backgroundColor: "var(--gr-grey-5)",
        color: "var(--gr-ink)",
      }}
    >
      <h1 className="text-2xl font-semibold" style={{ color: "var(--gr-ink)" }}>
        Intra Company Acct Coding{" "}
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            marginLeft: "0.5rem",
          }}
        >
          v1.0
        </span>
      </h1>

      <CodingGridSwitcher />
    </main>
  );
}

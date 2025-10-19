import CodingGridSwitcher from "./CodingGridSwitcher";

export const metadata = {
  title: "Intra-Company Coding | Graniterock",
};

export default function CodingPage() {
  return (
    <main
      className="w-full px-6 py-6 space-y-6 min-h-screen flex flex-col"
      style={{
        backgroundColor: "color-mix(in srgb, var(--gr-grey-5) 45%, white)",
        color: "var(--gr-ink)",
      }}
    >
      <h1 className="text-2xl font-semibold" style={{ color: "var(--gr-ink)" }}>
        Intra Company Acct Coding (v1)
      </h1>

      <CodingGridSwitcher />
    </main>
  );
}

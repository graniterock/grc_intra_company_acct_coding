import CodingGridSwitcher from "./CodingGridSwitcher";

export const metadata = {
  title: "Intra-Company Coding | Graniterock",
};

export default function CodingPage() {
  return (
    <main className="w-full px-6 py-6 space-y-6 min-h-screen flex flex-col">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--gr-ink)" }}>
        Intra-Company Coding
      </h1>

      <CodingGridSwitcher />
    </main>
  );
}

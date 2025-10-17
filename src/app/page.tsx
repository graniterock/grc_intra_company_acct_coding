import TicketsGrid from "../components/grids/TicketsGrid";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--gr-ink)" }}>
        Tickets – Prototype
      </h1>
      <p><a className="underline" href="/coding">Open Coding (Tickets & Orders) →</a></p>
      <TicketsGrid />
    </main>
  );
}

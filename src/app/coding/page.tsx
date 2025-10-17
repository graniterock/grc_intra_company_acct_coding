import TicketsGrid from "../../components/grids/TicketsGrid";
import OrdersGrid  from "../../components/grids/OrdersGrid";
import { Tabs } from "../../components/ui/Tabs";

export const metadata = {
  title: "Intra-Company Coding | Graniterock",
};

export default function CodingPage() {
  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--gr-ink)" }}>
        Intra-Company Coding
      </h1>

      <Tabs labels={["Tickets", "Orders"]}>
        {[<TicketsGrid key="t" />, <OrdersGrid key="o" />]}
      </Tabs>
    </main>
  );
}

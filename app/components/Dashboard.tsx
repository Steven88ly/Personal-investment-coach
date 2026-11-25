import type { DashboardView } from "../../lib/dashboard";
import { AllocationPanel } from "./AllocationPanel";
import { BenchmarkPanel } from "./BenchmarkPanel";
import { EmptyPortfolio } from "./EmptyPortfolio";
import { Header } from "./Header";
import { PortfolioHero } from "./PortfolioHero";
import { HoldingsTable } from "./HoldingsTable";
import { SummaryStrip } from "./SummaryStrip";

export function Dashboard({ view }: { view: DashboardView }) {
  const hasHero = view.daily.length >= 2;
  return (
    <main className="mx-auto flex max-w-[1024px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <Header asOf={view.asOf} />
      {view.isEmpty ? (
        <EmptyPortfolio />
      ) : (
        <>
          {hasHero && <PortfolioHero daily={view.daily} />}
          <SummaryStrip totals={view.totals} showValue={!hasHero} />
          <HoldingsTable rows={view.rows} asOf={view.asOf} />
          <AllocationPanel byAssetClass={view.byAssetClass} byHolding={view.byHolding} total={view.totals.value} />
          {view.benchmark && <BenchmarkPanel benchmark={view.benchmark} />}
        </>
      )}
    </main>
  );
}

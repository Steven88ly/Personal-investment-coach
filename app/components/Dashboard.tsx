import type { DashboardView } from "../../lib/dashboard";
import { AccountsPanel } from "./AccountsPanel";
import { AllocationPanel } from "./AllocationPanel";
import { BenchmarkPanel } from "./BenchmarkPanel";
import { ChecksPanel } from "./ChecksPanel";
import { CoachPanel } from "./CoachPanel";
import { EmptyPortfolio } from "./EmptyPortfolio";
import { Header } from "./Header";
import { PortfolioHero } from "./PortfolioHero";
import { ProjectorPanel } from "./ProjectorPanel";
import { HoldingsTable } from "./HoldingsTable";
import { NewsPanel } from "./NewsPanel";
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
          {view.digest && <NewsPanel digest={view.digest} />}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <AccountsPanel accounts={view.accounts} />
            <ChecksPanel checks={view.checks} />
          </div>
          <AllocationPanel byAssetClass={view.byAssetClass} byHolding={view.byHolding} total={view.totals.value} />
          {view.benchmark && <BenchmarkPanel benchmark={view.benchmark} />}
          <ProjectorPanel surplusLine={view.surplus?.line ?? null} />
          <CoachPanel />
        </>
      )}
    </main>
  );
}

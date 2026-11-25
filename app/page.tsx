import benchmarkSeed from "../data/benchmark.seed.json";
import dailySeed from "../data/daily.seed.json";
import holdingsSeed from "../data/holdings.seed.json";
import { buildDashboard } from "../lib/dashboard";
import type { BenchmarkPoint, DailyPoint, Holding } from "../lib/types";
import { Dashboard } from "./components/Dashboard";

/** `?portfolio=empty` shows the empty state (DESIGN.md "States"). */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ portfolio?: string | string[] }>;
}) {
  const { portfolio } = await searchParams;
  const holdings = portfolio === "empty" ? [] : (holdingsSeed as Holding[]);
  return (
    <Dashboard
      view={buildDashboard(holdings, benchmarkSeed as BenchmarkPoint[], dailySeed as DailyPoint[])}
    />
  );
}

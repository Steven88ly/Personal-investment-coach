# FinCoach — Real broker data (post-Thursday roadmap)

> Status: RESEARCHED Nov 25, 2026. NOT in the Thursday MVP. The MVP ships
> with mock data; this doc is the plan for wiring real accounts after the
> demo, and the architecture seam to build now.

## Short answer

Yes. This is a solved problem — brokerage aggregation APIs exist exactly
for a "god's-eye view" of all your accounts. For a Canadian, the right
one is **SnapTrade**. Plaid Investments is the alternative.

## SnapTrade (recommended for Canada)

- What it is: an API that connects a user's brokerage accounts and returns
  holdings, balances, and transaction history. Read-only by default.
- Canadian brokers covered (per SnapTrade docs, checked Nov 25, 2026):
  Questrade (read-only), Wealthsimple (self-directed accounts only),
  TD Direct Investing, BMO InvestorLine, CIBC Investor's Edge, National
  Bank Direct Brokerage, Qtrade Direct Investing, Webull Canada.
  NOT covered: RBC Direct Investing, Scotia iTRADE.
- Free plan: up to 5 brokerage connections.
- Auth: SnapTrade's hosted portal handles the broker login — your app
  never sees or stores the user's brokerage password. Questrade connects
  via official OAuth and is the most stable (rarely needs reconnecting);
  Wealthsimple is fastest to set up but asks to reconnect more often;
  Interactive Brokers needs a one-time token setup.
- Production access for a commercial key needs SnapTrade approval; the
  personal/OAuth path is lighter. Either way, allow days, not hours.

## Plaid Investments (alternative)

- Read-only holdings + cost basis + up to 24 months of investment
  transactions, via the Plaid Link flow.
- Coverage: 3,213 institutions with investments, but only 15 Canadian.
- Pricing: monthly subscription per connected account (Item); sandbox is
  free and the trial plan allows 10 production Items for new Canadian teams.
- Data refreshes at least once per market day. Good for bank accounts too,
  which SnapTrade doesn't cover — so Plaid is the pick if the app ever
  wants chequing/savings alongside brokerages.

## Why not Thursday night

1. Production approval + OAuth flows + testing against real accounts
   takes days, and you can't test it properly without connecting a real
   brokerage.
2. The security bar jumps: real money data needs encrypted token storage,
   read-only scopes, revoke/disconnect flows, and a real threat model.
   Half-built, that's worse than mock data.
3. Demo privacy: connecting your live accounts means anyone watching the
   demo sees your real money. Mock data is the right call for a demo.

## The architecture to build NOW (Thursday-safe)

Build the seam, not the integration. One interface, two implementations:

```ts
interface PortfolioProvider {
  getHoldings(): Promise<Holding[]>;
  getBenchmarkSeries(): Promise<BenchmarkPoint[]>;
  source: "mock" | "snaptrade" | "plaid";
}
class MockProvider implements PortfolioProvider { /* seed data, now */ }
class SnapTradeProvider implements PortfolioProvider { /* after Thursday */ }
```

Everything downstream (dashboard, coach, projector) only ever talks to
`PortfolioProvider`. Swapping mock → live is a one-line change plus the
connection UI. That seam is itself an engineering decision worth
talking through.

## The pragmatic middle step: CSV import

Before full OAuth, let the user upload a broker statement CSV
(Questrade and Wealthsimple both export them) and parse it into
holdings. No approvals, no credentials, no third party — and it proves
the aggregation idea with real data. Good v2 feature.

## Security requirements for real data (do not skip)

- Read-only scopes only. Never request trading permission.
- OAuth tokens stored server-side, encrypted at rest; never in the client,
  never in logs, never in git.
- Brokerage passwords are never seen by the app — auth happens on the
  provider's hosted portal.
- Disconnect/revoke flow: one click removes the connection and deletes
  stored tokens and cached holdings.
- No holdings data sent to the AI coach beyond the same aggregates the
  mock version uses; the advice-refusal rule still applies.
- Data retention stated in the README: what is stored, for how long,
  and how to delete it.

## Steps after Thursday

1. Create a SnapTrade developer account; get sandbox keys.
2. Build `SnapTradeProvider` against sandbox data.
3. Connect one of your own accounts (Questrade first — most stable).
4. Add the connect/disconnect UI + CSV import as a fallback.
5. Re-run the coach eval set against live data before showing anyone.

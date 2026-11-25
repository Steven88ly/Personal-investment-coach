import type { AccountSummary } from "../../lib/accounts";
import { Card } from "./Card";

/** SPEC section 7: one plain-language line per account. Informational only. */
export function AccountsPanel({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <Card id="accounts-heading" title="Accounts" note="Tags are informational, not tax advice.">
      <ul className="flex flex-col gap-4 text-[14px]">
        {accounts.map((a) => (
          <li key={a.account}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="flex items-center gap-2">
                <span className="rounded-full border border-stone px-2 py-px text-[12px] text-pebble">{a.account}</span>
                <span className="font-semibold">{a.name}</span>
              </span>
              <span className="font-medium tabular-nums">{a.value}</span>
            </div>
            <p className="mt-1 text-pebble">{a.explainer}</p>
            <p className="mt-0.5 text-[13px] text-pebble">Holds {a.tickers.join(", ")}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

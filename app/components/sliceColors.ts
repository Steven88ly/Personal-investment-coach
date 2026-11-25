/**
 * Asset-class colours, fixed per class (never by rank). Validated with the
 * dataviz checker on #FCFCFC, all pairs (the ring wraps): all checks pass.
 * Green and red stay reserved for gains and losses.
 *
 * Lives outside the "use client" donut so server components (the allocation
 * table's swatches) get the real values, not a client-reference proxy.
 */
export const SLICE_COLORS: Record<string, string> = {
  ETFs: "#0891b2",
  Stocks: "#7c3aed",
  Cash: "#c2870a",
};

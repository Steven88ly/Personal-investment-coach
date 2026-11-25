import { defineConfig } from "vitest/config";

// Live evals against the real model: kept out of `npm test` (network, cost).
export default defineConfig({
  test: {
    include: ["evals/**/*.eval.ts"],
    testTimeout: 90_000,
    fileParallelism: false,
  },
});

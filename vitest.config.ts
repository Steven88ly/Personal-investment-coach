import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next's tsconfig uses jsx: "preserve"; tests need JSX compiled.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});

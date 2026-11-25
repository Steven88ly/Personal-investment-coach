import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The coach reads its system prompt from lib/coach-prompt.md at runtime.
  outputFileTracingIncludes: { "/api/coach": ["./lib/coach-prompt.md"] },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from ./drizzle at runtime; make sure they ship with serverless functions.
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
};

export default nextConfig;

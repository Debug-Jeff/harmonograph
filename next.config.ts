import type { NextConfig } from "next";

const isStatic = process.env.HARMONY_STATIC === "1";

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export" as const } : {}),
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;

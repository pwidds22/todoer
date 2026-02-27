import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true, // Required for static export
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

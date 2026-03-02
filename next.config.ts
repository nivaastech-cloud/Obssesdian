import type { NextConfig } from "next";

const nextConfig: any = {
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  experimental: {
    turbo: {
      resolveAlias: {
        canvas: './src/utils/empty-module.js',
      },
    },
  },
};

export default nextConfig;

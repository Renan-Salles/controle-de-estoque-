import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fixa a raiz do workspace no proprio projeto (havia lockfiles em C:\Users\media).
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Permite o acesso via 127.0.0.1 em dev (QA headless) sem aviso de cross-origin.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;

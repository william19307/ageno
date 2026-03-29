import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 避免多 lockfile 时 Turbopack 误判仓库根目录，导致 standalone 路径错误 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  serverExternalPackages: ["pdf-parse", "canvas", "mammoth", "xlsx"],
};

export default nextConfig;

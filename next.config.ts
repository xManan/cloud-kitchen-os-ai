import type { NextConfig } from "next";
import { normaliseBasePath } from "./lib/base-path";

// Serve the app under a prefix (vercel_url/cloud-kitchen-os) when NEXT_PUBLIC_BASE_PATH is set.
const basePath = normaliseBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  // The bare domain would 404 under a prefix, so send it to the app.
  async redirects() {
    return basePath ? [{ source: "/", destination: basePath, basePath: false, permanent: false }] : [];
  },
};

export default nextConfig;

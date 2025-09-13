// next.config.ts
import type { NextConfig } from "next";

/**
 * We only apply basePath/assetPrefix in production, so local dev stays simple.
 */
const isProd = process.env.NODE_ENV === "production";
const repoName = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/^\//, "") || "";
console.log({ isProd });
console.log({ repoName })

/**
 * Your GitHub repository name (for Project Pages):
 * The site will be served from: https://<user>.github.io/<repoName>/
 *

/**
 * Next.js config tailored for GitHub Pages:
 * - output: "export"        → static HTML export to /out
 * - images.unoptimized: true → disable Image Optimization (not supported on GH Pages)
 * - trailingSlash: true     → ensures /path/ → /path/index.html (static host friendly)
 * - basePath/assetPrefix    → make URLs work under /<repoName> subpath in production
 */
const nextConfig: NextConfig = {
    // 1) Static export (no SSR)
    output: "export",

    // 2) Disable Next Image Optimization (GH Pages is a static CDN)
    images: {
        unoptimized: true,
    },

    // 3) Emit trailing slashes so each route maps to an index.html file
    trailingSlash: true,

    // 4) Only set subpath in production builds for GitHub Pages
    basePath: isProd && repoName ? `/${repoName}` : "",
    assetPrefix: isProd && repoName ? `/${repoName}/` : "",

    // Optional: if you want CI builds to pass even with lint issues
    // eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

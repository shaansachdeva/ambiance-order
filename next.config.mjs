/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-better-sqlite3",
      "@prisma/adapter-pg",
      "better-sqlite3",
      "pg",
    ],
    // Preserve scroll position when navigating Back/Forward so users land where
    // they left off on long lists (e.g., orders) instead of being snapped to top.
    scrollRestoration: true,
  },
};

export default nextConfig;

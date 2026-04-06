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
  },
};

export default nextConfig;

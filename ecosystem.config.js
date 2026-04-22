module.exports = {
  apps: [
    {
      name: "ambiance-order",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      // Cluster mode with 2 workers — Node is single-threaded; one process
      // can serve ~30-50 req/s max. 2 workers roughly doubles throughput and
      // also means if one OOMs, users stay served by the other.
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        DB_PROVIDER: "postgresql",
      },
      autorestart: true,
      // Raised from 500M — Next.js + Prisma + adapter-pg pool sits around
      // 250-400M idle; a burst of concurrent requests can spike past 500M
      // and trigger a restart loop.
      max_memory_restart: "1G",
      watch: false,
      merge_logs: true,
      out_file: "./logs/app-out.log",
      error_file: "./logs/app-error.log",
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};

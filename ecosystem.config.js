module.exports = {
  apps: [
    {
      name: "ambiance-order",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        DB_PROVIDER: "postgresql",
      },
      autorestart: true,
      max_memory_restart: "500M",
      watch: false,
      merge_logs: true,
      out_file: "./logs/app-out.log",
      error_file: "./logs/app-error.log",
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};

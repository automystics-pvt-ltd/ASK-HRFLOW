module.exports = {
  apps: [
    {
      name: 'ask-hrflow',
      cwd: __dirname,
      script: 'npx',
      args: 'tsx server/src/index.ts',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
    },
  ],
};

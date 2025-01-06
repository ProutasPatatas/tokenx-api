module.exports = {
  apps: [
    {
      name: "tokenx",
      script: "./index.js", // Your entry point
      env: {
        NODE_ENV: "production", // Can still add general env variables here
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};

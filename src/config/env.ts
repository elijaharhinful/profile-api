export const config = {
  port: process.env.PORT || "3000",
  nodeEnv: process.env.NODE_ENV || "development",
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackUrlCLI: process.env.GITHUB_CALLBACK_URL_CLI || "http://localhost:9876/callback",
    callbackUrlWeb: process.env.GITHUB_CALLBACK_URL_WEB!,
  },
  tokens: {
    accessExpiryMs: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MS || "180000"),   // 3 min
    refreshExpiryMs: parseInt(process.env.REFRESH_TOKEN_EXPIRY_MS || "300000"), // 5 min
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  redisUrl: process.env.REDIS_URL || "",
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || "60"),
};
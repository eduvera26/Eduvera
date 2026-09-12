import { resolve } from "node:path";
import { z } from "zod";

const booleanString = (defaultValue: "true" | "false") => z
  .string()
  .default(defaultValue)
  .transform((value) => ["1", "true", "yes", "on"].includes(value.toLowerCase()));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default("omnischool_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(604800).default(28800),
  COOKIE_SECRET: z.string().min(32).default("development-only-cookie-secret-change-me-now"),
  COOKIE_SECURE: booleanString("false"),
  TRUST_PROXY: booleanString("true"),
  ALLOWED_ORIGINS: z.string().default("http://127.0.0.1:8000,http://localhost:8000"),
  DEMO_MODE: booleanString("false"),
  SPA_DIST_DIR: z.string().default("../frontend/dist"),
  STAFF_DIST_DIR: z.string().default("../frontend-desktop/dist"),
  PUBLIC_URL: z.string().optional(),
  UPLOAD_DIR: z.string().default("./storage/leave-documents"),
  AI_PROVIDER: z.enum(["mock", "ollama", "openai-compatible"]).default("mock"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen3:8b"),
  OPENAI_COMPATIBLE_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  LOG_LEVEL: z.string().default("info"),
  // "postgres" shares buckets across API instances; "memory" costs nothing per request.
  RATE_LIMIT_STORE: z.enum(["postgres", "memory"]).optional(),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const value = schema.parse(process.env);
  if (value.NODE_ENV === "production" && value.COOKIE_SECRET.includes("development-only")) {
    throw new Error("COOKIE_SECRET must be changed in production");
  }
  return {
    ...value,
    rateLimitStore: value.RATE_LIMIT_STORE ?? (value.NODE_ENV === "production" ? "postgres" : "memory"),
    allowedOrigins: value.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    spaDistDir: resolve(process.cwd(), value.SPA_DIST_DIR),
    staffDistDir: resolve(process.cwd(), value.STAFF_DIST_DIR),
    uploadDir: resolve(process.cwd(), value.UPLOAD_DIR),
  };
}

let cached: AppConfig | undefined;
export function config(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

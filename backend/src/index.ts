import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__here, "../../.env") });
dotenv.config({ path: resolve(__here, "../.env") });
import express from "express";
import type { CorsOptions } from "cors";
import { defineRouter } from "./routes/define.js";
import { statsRouter } from "./routes/stats.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

function normalizePagesHost(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  try {
    const u = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
    return u.hostname.toLowerCase();
  } catch {
    return raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]!
      .trim();
  }
}

/** 允许 https://{hash}.project.pages.dev 与 https://project.pages.dev（与 CORS_ORIGINS 并存） */
function isCloudflarePagesDeploymentOrigin(origin: string, projectHost: string): boolean {
  if (!projectHost) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === projectHost || h.endsWith(`.${projectHost}`);
  } catch {
    return false;
  }
}

function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();
  const list =
    raw?.split(",").map((s) => s.trim()).filter((s) => s.length > 0) ?? [];
  const pagesProjectHost = normalizePagesHost(process.env.CORS_PAGES_PROJECT_HOST);

  if (list.length === 0) {
    return {
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };
  }

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (list.includes(origin)) {
        callback(null, true);
        return;
      }
      if (isCloudflarePagesDeploymentOrigin(origin, pagesProjectHost)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: "16kb" }));

app.use("/api", defineRouter);
app.use("/api", statsRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

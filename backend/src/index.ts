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

function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();
  const list =
    raw?.split(",").map((s) => s.trim()).filter((s) => s.length > 0) ?? [];
  if (list.length === 0) {
    return {
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };
  }
  return {
    origin: list,
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

import { Router } from "express";
import {
  applySiteLike,
  getHomeSnapshot,
  getTermSnapshot,
  incHomeView,
  incSiteShare,
  incTermView,
} from "../services/statsStore.js";

export const statsRouter = Router();

statsRouter.get("/stats", (req, res) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : "";
  const term = typeof req.query.term === "string" ? req.query.term : "";

  if (scope === "home") {
    const h = getHomeSnapshot();
    res.json({
      ok: true,
      scope: "home",
      homeViews: h.homeViews,
      likes: h.likes,
      shares: h.shares,
    });
    return;
  }

  if (term.trim()) {
    const s = getTermSnapshot(term);
    res.json({
      ok: true,
      term: term.trim().slice(0, 64),
      views: s.views,
      likes: s.likes,
      shares: s.shares,
    });
    return;
  }

  res.status(400).json({
    ok: false,
    error: "BAD_QUERY",
    message: "请提供 ?scope=home 或 ?term=…",
  });
});

type TEventBody = {
  kind?: unknown;
  term?: unknown;
  likeOn?: unknown;
  scope?: unknown;
};

statsRouter.post("/stats/event", (req, res) => {
  const body = req.body as TEventBody;
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!["view", "share", "like"].includes(kind)) {
    res.status(400).json({
      ok: false,
      error: "BAD_BODY",
      message: "kind 须为 view | share | like",
    });
    return;
  }

  const scopeHome = body.scope === "home";
  const termRaw = typeof body.term === "string" ? body.term.trim() : "";
  const term = termRaw.length > 0 ? termRaw.slice(0, 64) : null;

  try {
    if (kind === "view") {
      if (scopeHome) incHomeView();
      else if (term) incTermView(term);
      else {
        res.status(400).json({
          ok: false,
          error: "BAD_BODY",
          message: "view 需 scope=home 或有效 term",
        });
        return;
      }
    } else if (kind === "share") {
      incSiteShare();
    } else if (kind === "like") {
      applySiteLike(body.likeOn === true);
    }
  } catch {
    res.status(500).json({ ok: false, error: "STATS_ERROR", message: "统计失败" });
    return;
  }

  res.json({ ok: true });
});

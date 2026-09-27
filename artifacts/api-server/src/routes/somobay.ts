import { Router, type IRouter, type Response as ExpressResponse } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const STATE_PATH = "/rest/v1/somobay_state";

type SharedState = Record<string, unknown>;
type ProxyInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function isRecord(value: unknown): value is SharedState {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function supabaseRequest(path: string, init: ProxyInit = {}) {
  return connectors.proxy("supabase", path, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

function sendSupabaseError(res: ExpressResponse, body: string) {
  let parsed: { code?: string; message?: string } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    // Keep the raw response in the server log, but return a stable API error.
  }

  if (parsed.code === "PGRST205" || body.includes("somobay_state")) {
    res.status(503).json({
      code: "SUPABASE_SCHEMA_MISSING",
      message: "Supabase table somobay_state is not initialized. Run supabase/somobay-schema.sql once.",
    });
    return;
  }

  res.status(502).json({
    code: "SUPABASE_REQUEST_FAILED",
    message: parsed.message ?? "Supabase request failed.",
  });
}

router.get("/somobay/state", async (_req, res) => {
  try {
    const response = await supabaseRequest(`${STATE_PATH}?id=eq.1&select=id,state,updated_at&limit=1`);
    const body = await response.text();
    if (!response.ok) {
      sendSupabaseError(res, body);
      return;
    }

    const rows = JSON.parse(body) as Array<{ id: number; state: SharedState; updated_at: string }>;
    res.json({
      state: rows[0]?.state ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (error) {
    res.status(502).json({
      code: "SUPABASE_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Supabase is unavailable.",
    });
  }
});

router.put("/somobay/state", async (req, res) => {
  if (!isRecord(req.body?.state)) {
    res.status(400).json({ code: "INVALID_STATE", message: "A state object is required." });
    return;
  }

  try {
    const response = await supabaseRequest(`${STATE_PATH}?on_conflict=id`, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: 1,
        state: req.body.state,
        updated_at: new Date().toISOString(),
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      sendSupabaseError(res, body);
      return;
    }

    const rows = JSON.parse(body) as Array<{ updated_at: string }>;
    res.json({ ok: true, updatedAt: rows[0]?.updated_at ?? new Date().toISOString() });
  } catch (error) {
    res.status(502).json({
      code: "SUPABASE_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Supabase is unavailable.",
    });
  }
});

export default router;
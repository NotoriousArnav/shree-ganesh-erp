import type { IncomingMessage, ServerResponse } from "node:http";

let mushakPromise: Promise<any> | null = null;
let lokkhiPromise: Promise<any> | null = null;

async function getMushak() {
  if (!mushakPromise) {
    mushakPromise = (async () => {
      // @ts-ignore
      const mod = await import("../mushak/backend/dist/app.mjs");
      const app = mod.app || mod.default;
      await app.ready();
      return app;
    })();
  }
  return mushakPromise;
}

async function getLokkhi() {
  if (!lokkhiPromise) {
    lokkhiPromise = (async () => {
      // @ts-ignore
      const mod = await import("../lokkhi/backend/dist/app.mjs");
      const app = mod.app || mod.default;
      await app.ready();
      return app;
    })();
  }
  return lokkhiPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.url && req.url.startsWith("/lokkhi")) {
      req.url = req.url.slice("/lokkhi".length) || "/";
      const app = await getLokkhi();
      app.server.emit("request", req, res);
    } else {
      const app = await getMushak();
      app.server.emit("request", req, res);
    }
  } catch (err: any) {
    console.error("Handler error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Internal Server Error", message: err?.message }));
  }
}

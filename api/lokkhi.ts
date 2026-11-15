import type { IncomingMessage, ServerResponse } from "node:http";

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      // @ts-ignore
      const mod = await import("../lokkhi/backend/dist/app.mjs");
      const app = mod.app || mod.default;
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.url && req.url.startsWith("/lokkhi")) {
      req.url = req.url.slice("/lokkhi".length) || "/";
    }
    const app = await getApp();
    app.server.emit("request", req, res);
  } catch (err: any) {
    console.error("Lokkhi handler error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Internal Server Error", message: err?.message }));
  }
}

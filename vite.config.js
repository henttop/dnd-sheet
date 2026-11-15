import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

function webhookProxyPlugin() {
  return {
    name: "webhook-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith("/api/webhook-proxy")) {
          try {
            const u = new URL(req.url, "http://localhost:5173");
            const target = u.searchParams.get("target");
            if (!target || (!target.startsWith("https://discord.com/api/webhooks/") && !target.startsWith("https://discordapp.com/api/webhooks/"))) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Invalid target webhook URL" }));
              return;
            }

            const cleanTarget = target.replace("discordapp.com/api/webhooks/", "discord.com/api/webhooks/");

            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const bodyBuffer = Buffer.concat(chunks);

            const headers = {};
            if (req.headers["content-type"]) {
              headers["content-type"] = req.headers["content-type"];
            }

            const discordRes = await fetch(cleanTarget, {
              method: "POST",
              headers,
              body: bodyBuffer
            });

            const responseText = await discordRes.text().catch(() => "");
            res.statusCode = discordRes.status;
            res.setHeader("Content-Type", "application/json");
            res.end(responseText || JSON.stringify({ ok: true, status: discordRes.status }));
            return;
          } catch (err) {
            console.error("[webhook-proxy error]", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message || "Proxy error" }));
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), webhookProxyPlugin()],
  server: { port: 5173 },
});

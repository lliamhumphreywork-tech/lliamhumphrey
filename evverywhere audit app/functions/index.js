const { onRequest } = require("firebase-functions/v2/https");

/**
 * Anthropic API proxy — forwards browser requests to api.anthropic.com
 * server-to-server, bypassing CORS restrictions.
 * The API key is passed from the client in the Authorization header.
 */
exports.anthropicProxy = onRequest(
  {
    cors: [
      "https://evverywhere-workspace-a654e.web.app",
      "https://evverywhere-workspace-a654e.firebaseapp.com",
      "http://localhost:3458",
      "http://localhost:5173",
    ],
    timeoutSeconds: 180,
    memory: "256MiB",
    region: "us-central1",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const apiKey = (req.headers.authorization || "")
      .replace(/^Bearer\s+/, "")
      .trim();

    if (!apiKey) {
      res.status(401).json({ error: { message: "Missing Anthropic API key" } });
      return;
    }

    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(req.body),
      });

      // Mirror status and content-type from Anthropic
      res.status(anthropicRes.status);
      const ct = anthropicRes.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);

      // Stream the SSE response chunk-by-chunk
      const reader = anthropicRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err) {
      console.error("Anthropic proxy error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: { message: err.message || "Proxy error" } });
      } else {
        res.end();
      }
    }
  }
);

import { serve } from "@hono/node-server";
import app from "@/api/server.js";
import { startBot } from "@/bot/client.js";

const PORT = 3000;

// jalanin API
serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🌐 API running on http://localhost:${PORT}`);

// jalanin bot
startBot();
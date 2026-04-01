import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("API Jalan 🚀"));

app.post("/create-game", async (c) => {
  const body = await c.req.json();

  return c.json({
    success: true,
    message: "Game created",
    data: body,
  });
});

export default app;
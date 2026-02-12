import { Hono } from "hono";
import { cors } from "hono/cors";
import { turtleSoups, getTurtleSoupById } from "./data/turtleSoups";
import { HOST_SYSTEM_PROMPT } from "./prompts/hostPrompt";
import { callQianwenChat } from "./services/qianwenClient";
import type { ChatCompletionMessageParam } from "./services/types";

type Bindings = {};

const app = new Hono<{ Bindings: Bindings }>();

// 允许前端跨域访问（本地开发 & 不同域名部署时有用）
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"]
  })
);

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

app.get("/api/turtle-soups", (c) => {
  const list = turtleSoups.map((t) => ({
    id: t.id,
    title: t.title,
    opening: t.opening,
    difficulty: t.difficulty,
    tags: t.tags
  }));
  return c.json(list);
});

app.get("/api/turtle-soups/:id", (c) => {
  const id = c.req.param("id");
  const soup = getTurtleSoupById(id);
  if (!soup) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  // 默认不返回真相，只返回开局描述等玩家可见信息
  const includeTruth = c.req.query("includeTruth") === "1";

  return c.json({
    id: soup.id,
    title: soup.title,
    opening: soup.opening,
    difficulty: soup.difficulty,
    tags: soup.tags,
    truth: includeTruth ? soup.truth : undefined
  });
});

interface AskBody {
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

app.post("/api/turtle-soups/:id/ask", async (c) => {
  const id = c.req.param("id");
  const soup = getTurtleSoupById(id);
  if (!soup) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  let body: AskBody;
  try {
    body = await c.req.json<AskBody>();
  } catch {
    return c.json({ error: "INVALID_JSON" }, 400);
  }

  if (!body.question || typeof body.question !== "string") {
    return c.json({ error: "INVALID_QUESTION" }, 400);
  }

  const history = body.history ?? [];

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: HOST_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: [
        "以下是本题的【真相】与【开局描述】（只给你看，玩家看不到）：",
        "",
        `【真相】:\n${soup.truth}`,
        "",
        `【开局描述】:\n${soup.opening}`,
        "",
        "下面是到目前为止的对话历史（如果有）："
      ].join("\n")
    },
    ...history.map<ChatCompletionMessageParam>((h) => ({
      role: h.role,
      content: h.content
    })),
    {
      role: "user",
      content: `玩家的新提问或请求是：${body.question}`
    }
  ];

  try {
    const answer = await callQianwenChat(messages, { temperature: 0.6 });
    return c.json({ answer });
  } catch (err: any) {
    return c.json(
      {
        error: "QIANWEN_ERROR",
        message: err?.message ?? String(err)
      },
      500
    );
  }
});

export default app;


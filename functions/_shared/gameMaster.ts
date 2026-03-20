import { HOST_SYSTEM_PROMPT } from "./hostPrompt";
import { callQianwenChat, type QianwenEnv } from "./qianwenClient";
import type { ChatCompletionMessageParam } from "./types";
import type { SessionData, SessionPlayer } from "./sessions";

export type TurnMode = "question" | "hint" | "progress" | "theory";

export interface SoupContext {
  id: string;
  title: string;
  opening: string;
  truth: string;
  difficulty: number;
  tags?: string[];
}

export interface HostResult {
  verdict: string;
  reply: string;
  progress: number;
  solved: boolean;
  solutionSummary: string;
  celebration: string;
  mode: TurnMode;
}

function clampProgress(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function estimateProgress(session: SessionData): number {
  const questionScore = session.players.reduce((sum, player) => sum + player.questionsAsked, 0) * 4;
  const theoryScore = session.players.reduce((sum, player) => sum + player.theoriesSubmitted, 0) * 8;
  const base = session.phase === "solved" ? 100 : 12;
  return Math.max(8, Math.min(session.phase === "solved" ? 100 : 90, base + questionScore + theoryScore));
}

function fallbackReply(mode: TurnMode): string {
  if (mode === "hint") {
    return "提示：把注意力放在人物关系、关键动作和结果之间的因果链上。";
  }
  if (mode === "progress") {
    return "当前进度 42%，你们已经摸到边缘，但关键反转还没完全对上。";
  }
  if (mode === "theory") {
    return "这个推理已经有点味道了，但还差最后那条决定性的因果链。";
  }
  return "无法确定。这个问题还可以再收窄一点。";
}

function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function transcriptFromSession(session: SessionData): string {
  const turns = session.history.slice(-18);
  if (!turns.length) {
    return "暂无对话。";
  }

  return turns
    .map((turn) => {
      const speaker =
        turn.role === "assistant"
          ? "主持人"
          : turn.playerName
          ? `${turn.playerName}`
          : turn.role === "system"
          ? "系统"
          : "玩家";
      return `${speaker}（${turn.kind}）：${turn.content}`;
    })
    .join("\n");
}

export function detectTurnMode(question: string, explicitMode?: string): TurnMode {
  if (explicitMode === "hint" || explicitMode === "progress" || explicitMode === "theory") {
    return explicitMode;
  }

  const normalized = question.trim();
  if (normalized === "进度") return "progress";
  if (/(提示|卡住|给点方向|线索)/.test(normalized)) return "hint";
  if (/(我猜|我的推理|我的理论|真相是|答案是|我认为)/.test(normalized)) return "theory";
  return "question";
}

function buildMessages(
  session: SessionData,
  soup: SoupContext,
  player: SessionPlayer,
  question: string,
  mode: TurnMode
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: HOST_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: [
        `房间阶段：${session.phase}`,
        `题目标题：${soup.title}`,
        `题目难度：${soup.difficulty}`,
        `题目开局：${soup.opening}`,
        `题目真相：${soup.truth}`,
        `当前玩家：${player.name}`,
        `当前模式：${mode}`,
        `当前房内玩家：${session.players.map((item) => item.name).join("、") || "暂无"}`,
        `最近对话：\n${transcriptFromSession(session)}`,
        `玩家最新发言：${question}`,
        "请严格按 JSON 格式作答。"
      ].join("\n\n")
    }
  ];
}

export async function runHostTurn(
  session: SessionData,
  soup: SoupContext,
  player: SessionPlayer,
  question: string,
  explicitMode: string | undefined,
  env?: QianwenEnv
): Promise<HostResult> {
  const mode = detectTurnMode(question, explicitMode);
  const fallbackProgress = estimateProgress(session);
  const raw = await callQianwenChat(
    buildMessages(session, soup, player, question, mode),
    { temperature: mode === "theory" ? 0.35 : 0.55 },
    env
  );

  const parsed = extractJson(raw);
  const verdict =
    typeof parsed?.verdict === "string" && parsed.verdict.trim()
      ? parsed.verdict.trim()
      : mode === "question"
      ? "uncertain"
      : mode;

  const reply =
    typeof parsed?.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : fallbackReply(mode);

  const solved = Boolean(parsed?.solved) || verdict === "solved";
  const solutionSummary =
    typeof parsed?.solution_summary === "string" ? parsed.solution_summary.trim() : "";
  const celebration =
    typeof parsed?.celebration === "string" ? parsed.celebration.trim() : "";

  return {
    verdict,
    reply,
    progress: clampProgress(parsed?.progress, solved ? 100 : fallbackProgress),
    solved,
    solutionSummary,
    celebration,
    mode
  };
}

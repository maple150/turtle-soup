import { getTurtleSoupById } from "../../../_shared/turtleSoups";
import { runHostTurn } from "../../../_shared/gameMaster";
import {
  addHistoryTurn,
  addQuestionStat,
  addSessionEvent,
  addTheoryStat,
  buildSessionPayload,
  bumpPlayerScore,
  ensurePlayer,
  loadSession,
  markSolved,
  normalizePlayerName,
  saveSession,
  touchPlayer,
  type VisibleSoup
} from "../../../_shared/sessions";

interface AskBody {
  question?: string;
  playerId?: string;
  playerName?: string;
  mode?: "question" | "hint" | "progress" | "theory";
}

function toVisibleSoup(soupId: string): VisibleSoup | null {
  const soup = getTurtleSoupById(soupId);
  if (!soup) return null;
  return {
    id: soup.id,
    title: soup.title,
    opening: soup.opening,
    difficulty: soup.difficulty,
    tags: soup.tags
  };
}

export const onRequest = async (context: any): Promise<Response> => {
  const { request, params, env } = context;
  const id = params?.id as string | undefined;

  if (!id) {
    return new Response(JSON.stringify({ error: "MISSING_ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const session = await loadSession(env, id);
  if (!session) {
    return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const soup = getTurtleSoupById(session.soupId);
  if (!soup) {
    return new Response(JSON.stringify({ error: "SOUP_NOT_FOUND" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body: AskBody | null = null;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    body = null;
  }

  if (!body?.question || typeof body.question !== "string") {
    return new Response(JSON.stringify({ error: "INVALID_QUESTION" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const question = body.question.trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "EMPTY_QUESTION" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { player, joined } = ensurePlayer(
    session,
    {
      id: body.playerId,
      name: body.playerName ?? normalizePlayerName(body.playerName)
    },
    { isHost: session.players.length === 0 }
  );

  if (joined) {
    addSessionEvent(session, {
      kind: "player_joined",
      message: `${player.name} 加入了房间。`,
      actorId: player.id,
      actorName: player.name
    });
  }

  const mode = body.mode ?? "question";

  if (session.phase === "lobby") {
    session.phase = "playing";
    addSessionEvent(session, {
      kind: "game_started",
      message: "本局正式开始，第一轮推理开始滚动。"
    });
  }

  if (mode === "theory") {
    addTheoryStat(session, player.id);
  } else if (mode === "question") {
    addQuestionStat(session, player.id);
  } else {
    touchPlayer(session, player.id);
  }

  addHistoryTurn(session, {
    role: "user",
    kind: mode === "theory" ? "theory" : mode === "hint" ? "hint" : mode === "progress" ? "progress" : "question",
    content: question,
    playerId: player.id,
    playerName: player.name
  });

  addSessionEvent(session, {
    kind:
      mode === "theory"
        ? "theory_shared"
        : mode === "hint"
        ? "hint_requested"
        : mode === "progress"
        ? "progress_checked"
        : "question_asked",
    message:
      mode === "theory"
        ? `${player.name} 提交了一条完整推理。`
        : mode === "hint"
        ? `${player.name} 请求了一个提示。`
        : mode === "progress"
        ? `${player.name} 查看了团队进度。`
        : `${player.name} 抛出了一个新问题。`,
    actorId: player.id,
    actorName: player.name
  });

  const result = await runHostTurn(
    session,
    {
      id: soup.id,
      title: soup.title,
      opening: soup.opening,
      truth: soup.truth,
      difficulty: soup.difficulty,
      tags: soup.tags
    },
    player,
    question,
    mode,
    env
  );

  addHistoryTurn(session, {
    role: "assistant",
    kind:
      result.mode === "hint"
        ? "hint"
        : result.mode === "progress"
        ? "progress"
        : result.solved
        ? "celebration"
        : "host_reply",
    content: result.reply,
    verdict: result.verdict,
    progress: result.progress
  });

  if (result.solved && session.phase !== "solved") {
    const summary = result.solutionSummary || soup.truth;
    markSolved(session, summary);
    bumpPlayerScore(session, player.id, 12);
    addSessionEvent(session, {
      kind: "game_solved",
      message: result.celebration || `${player.name} 破解了这锅汤。`,
      actorId: player.id,
      actorName: player.name
    });
    addHistoryTurn(session, {
      role: "system",
      kind: "celebration",
      content: `真相揭晓：${summary}`
    });
  }

  await saveSession(env, session);

  const visibleSoup = toVisibleSoup(session.soupId);
  if (!visibleSoup) {
    return new Response(JSON.stringify({ error: "SOUP_NOT_FOUND" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(buildSessionPayload(session, visibleSoup)), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

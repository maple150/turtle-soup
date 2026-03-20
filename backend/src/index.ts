import { turtleSoups, getTurtleSoupById } from "./data/turtleSoups";
import { runHostTurn } from "./services/gameMaster";
import {
  addHistoryTurn,
  addQuestionStat,
  addSessionEvent,
  addTheoryStat,
  buildSessionPayload,
  bumpPlayerScore,
  createEmptySession,
  createRecordId,
  ensurePlayer,
  loadSession,
  markSolved,
  normalizePlayerName,
  saveSession,
  setPlayerReady,
  touchPlayer,
  type SessionEnv,
  type VisibleSoup
} from "./services/sessionStore";

interface Env extends SessionEnv {
  QIANWEN_API_KEY?: string;
  QIANWEN_ENDPOINT?: string;
  QIANWEN_MODEL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface PlayerBody {
  id?: string;
  name?: string;
}

interface CreateSessionBody {
  soupId?: string;
  player?: PlayerBody;
}

interface AskBody {
  question?: string;
  playerId?: string;
  playerName?: string;
  mode?: "question" | "hint" | "progress" | "theory";
}

interface PresenceBody {
  playerId?: string;
  playerName?: string;
}

interface ReadyBody extends PresenceBody {
  ready?: boolean;
}

function createCorsHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: createCorsHeaders()
  });
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders()
  });
}

async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
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

function openingBroadcast(title: string): string {
  return `汤面已就位：《${title}》。侦探们，开始拆解表象吧。`;
}

async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  const body = (await parseJson<CreateSessionBody>(request)) ?? {};
  const soup =
    (body.soupId ? getTurtleSoupById(body.soupId) : undefined) ??
    turtleSoups[Math.floor(Math.random() * turtleSoups.length)];

  if (!soup) {
    return json({ error: "NO_SOUP_AVAILABLE" }, 500);
  }

  const session = createEmptySession(createRecordId("room"), soup.id);

  addHistoryTurn(session, {
    role: "assistant",
    kind: "system",
    content: openingBroadcast(soup.title)
  });
  addSessionEvent(session, {
    kind: "system",
    message: "房间已创建，等待侦探入座。"
  });

  if (body.player) {
    const { player } = ensurePlayer(session, body.player, { isHost: true });
    addSessionEvent(session, {
      kind: "player_joined",
      message: `${player.name} 创建了房间，成为本局房主。`,
      actorId: player.id,
      actorName: player.name
    });
  }

  await saveSession(env, session);

  const visibleSoup = toVisibleSoup(session.soupId);
  if (!visibleSoup) {
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }

  return json(buildSessionPayload(session, visibleSoup));
}

async function handleGetSession(sessionId: string, env: Env): Promise<Response> {
  const session = await loadSession(env, sessionId);
  if (!session) {
    return json({ error: "NOT_FOUND" }, 404);
  }

  const soup = toVisibleSoup(session.soupId);
  if (!soup) {
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }

  return json(buildSessionPayload(session, soup));
}

async function handleJoinSession(
  request: Request,
  sessionId: string,
  env: Env
): Promise<Response> {
  const session = await loadSession(env, sessionId);
  if (!session) {
    return json({ error: "NOT_FOUND" }, 404);
  }

  const body = (await parseJson<PresenceBody>(request)) ?? {};
  const { player, joined } = ensurePlayer(session, body);

  if (joined) {
    addSessionEvent(session, {
      kind: "player_joined",
      message: `${player.name} 加入了房间。`,
      actorId: player.id,
      actorName: player.name
    });
    addHistoryTurn(session, {
      role: "system",
      kind: "system",
      content: `${player.name} 已入座，房间的推理气压又升高了一点。`,
      playerId: player.id,
      playerName: player.name
    });
  }

  await saveSession(env, session);

  const soup = toVisibleSoup(session.soupId);
  if (!soup) {
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }

  return json(buildSessionPayload(session, soup));
}

async function handlePresence(
  request: Request,
  sessionId: string,
  env: Env
): Promise<Response> {
  const session = await loadSession(env, sessionId);
  if (!session) {
    return json({ error: "NOT_FOUND" }, 404);
  }

  const body = (await parseJson<PresenceBody>(request)) ?? {};
  if (!body.playerId) {
    return json({ error: "MISSING_PLAYER_ID" }, 400);
  }

  const touched = touchPlayer(session, body.playerId);
  if (!touched && body.playerName) {
    ensurePlayer(session, {
      id: body.playerId,
      name: body.playerName
    });
  }

  await saveSession(env, session);
  const soup = toVisibleSoup(session.soupId);
  if (!soup) {
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }
  return json(buildSessionPayload(session, soup));
}

async function handleReady(
  request: Request,
  sessionId: string,
  env: Env
): Promise<Response> {
  const session = await loadSession(env, sessionId);
  if (!session) {
    return json({ error: "NOT_FOUND" }, 404);
  }

  const body = (await parseJson<ReadyBody>(request)) ?? {};
  if (!body.playerId) {
    return json({ error: "MISSING_PLAYER_ID" }, 400);
  }

  const player = setPlayerReady(session, body.playerId, Boolean(body.ready));
  if (!player) {
    return json({ error: "PLAYER_NOT_FOUND" }, 404);
  }

  addSessionEvent(session, {
    kind: "player_ready",
    message: player.ready ? `${player.name} 已准备。` : `${player.name} 取消了准备。`,
    actorId: player.id,
    actorName: player.name
  });

  if (
    session.phase === "lobby" &&
    session.players.length > 0 &&
    session.players.every((member) => member.ready)
  ) {
    addSessionEvent(session, {
      kind: "system",
      message: "全员已准备，随时可以开始审汤。"
    });
  }

  await saveSession(env, session);
  const soup = toVisibleSoup(session.soupId);
  if (!soup) {
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }
  return json(buildSessionPayload(session, soup));
}

async function handleAsk(request: Request, sessionId: string, env: Env): Promise<Response> {
  const session = await loadSession(env, sessionId);
  if (!session) {
    return json({ error: "NOT_FOUND" }, 404);
  }

  const soup = getTurtleSoupById(session.soupId);
  if (!soup) {
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }

  const body = await parseJson<AskBody>(request);
  if (!body?.question || typeof body.question !== "string") {
    return json({ error: "INVALID_QUESTION" }, 400);
  }

  const question = body.question.trim();
  if (!question) {
    return json({ error: "EMPTY_QUESTION" }, 400);
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
    return json({ error: "SOUP_NOT_FOUND" }, 500);
  }

  return json(buildSessionPayload(session, visibleSoup));
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") {
    return handleOptions();
  }

  if (path === "/api/health" && request.method === "GET") {
    return json({ ok: true });
  }

  if (path === "/api/turtle-soups" && request.method === "GET") {
    return json(
      turtleSoups.map((soup) => ({
        id: soup.id,
        title: soup.title,
        opening: soup.opening,
        difficulty: soup.difficulty,
        tags: soup.tags
      }))
    );
  }

  const soupMatch = path.match(/^\/api\/turtle-soups\/([^/]+)$/);
  if (soupMatch && request.method === "GET") {
    const soup = getTurtleSoupById(decodeURIComponent(soupMatch[1]));
    if (!soup) {
      return json({ error: "NOT_FOUND" }, 404);
    }

    const includeTruth = url.searchParams.get("includeTruth") === "1";
    return json({
      id: soup.id,
      title: soup.title,
      opening: soup.opening,
      difficulty: soup.difficulty,
      tags: soup.tags,
      truth: includeTruth ? soup.truth : undefined
    });
  }

  if (path === "/api/sessions" && request.method === "POST") {
    return handleCreateSession(request, env);
  }

  const joinMatch = path.match(/^\/api\/sessions\/([^/]+)\/join$/);
  if (joinMatch && request.method === "POST") {
    return handleJoinSession(request, decodeURIComponent(joinMatch[1]), env);
  }

  const presenceMatch = path.match(/^\/api\/sessions\/([^/]+)\/presence$/);
  if (presenceMatch && request.method === "POST") {
    return handlePresence(request, decodeURIComponent(presenceMatch[1]), env);
  }

  const readyMatch = path.match(/^\/api\/sessions\/([^/]+)\/ready$/);
  if (readyMatch && request.method === "POST") {
    return handleReady(request, decodeURIComponent(readyMatch[1]), env);
  }

  const askMatch = path.match(/^\/api\/sessions\/([^/]+)\/ask$/);
  if (askMatch && request.method === "POST") {
    return handleAsk(request, decodeURIComponent(askMatch[1]), env);
  }

  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === "GET") {
    return handleGetSession(decodeURIComponent(sessionMatch[1]), env);
  }

  return json({ error: "NOT_FOUND" }, 404);
}

export default {
  fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    return handleRequest(request, env);
  }
};

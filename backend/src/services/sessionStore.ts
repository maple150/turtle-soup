export type ChatRole = "user" | "assistant" | "system";
export type SessionPhase = "lobby" | "playing" | "solved";
export type ChatKind =
  | "question"
  | "theory"
  | "hint"
  | "progress"
  | "host_reply"
  | "system"
  | "celebration";
export type SessionEventKind =
  | "system"
  | "player_joined"
  | "player_ready"
  | "question_asked"
  | "theory_shared"
  | "hint_requested"
  | "progress_checked"
  | "game_started"
  | "game_solved";

export interface SessionPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  joinedAt: number;
  lastSeenAt: number;
  questionsAsked: number;
  theoriesSubmitted: number;
  score: number;
}

export interface ChatTurn {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  kind: ChatKind;
  playerId?: string;
  playerName?: string;
  verdict?: string;
  progress?: number;
}

export interface SessionEvent {
  id: string;
  kind: SessionEventKind;
  message: string;
  createdAt: number;
  actorId?: string;
  actorName?: string;
}

export interface SessionData {
  id: string;
  soupId: string;
  createdAt: number;
  updatedAt: number;
  phase: SessionPhase;
  solvedAt?: number;
  solutionSummary?: string;
  players: SessionPlayer[];
  history: ChatTurn[];
  events: SessionEvent[];
}

export interface SessionEnv {
  SESSIONS_KV?: KVNamespace;
}

export interface PlayerIdentityInput {
  id?: string;
  name?: string;
}

export interface VisibleSoup {
  id: string;
  title: string;
  opening: string;
  difficulty: number;
  tags?: string[];
}

const SESSION_PREFIX = "session:";
const ONLINE_WINDOW_MS = 45_000;
const HISTORY_LIMIT = 120;
const EVENT_LIMIT = 60;
const memorySessions = new Map<string, SessionData>();

function cloneSession(session: SessionData): SessionData {
  return JSON.parse(JSON.stringify(session)) as SessionData;
}

export function createRecordId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
}

export function normalizePlayerName(name?: string): string {
  const normalized = (name ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return `侦探${Math.floor(Math.random() * 900 + 100)}`;
  }
  return normalized.slice(0, 20);
}

export function createEmptySession(id: string, soupId: string): SessionData {
  const now = Date.now();
  return {
    id,
    soupId,
    createdAt: now,
    updatedAt: now,
    phase: "lobby",
    players: [],
    history: [],
    events: []
  };
}

export function ensurePlayer(
  session: SessionData,
  identity: PlayerIdentityInput,
  options: { isHost?: boolean } = {}
): { player: SessionPlayer; joined: boolean } {
  const id = identity.id?.trim() || createRecordId("player");
  const name = normalizePlayerName(identity.name);
  const now = Date.now();
  const existing = session.players.find((player) => player.id === id);

  if (existing) {
    existing.name = name;
    existing.lastSeenAt = now;
    if (options.isHost) {
      existing.isHost = true;
    }
    return { player: existing, joined: false };
  }

  const shouldBeHost = options.isHost || session.players.length === 0;
  const player: SessionPlayer = {
    id,
    name,
    isHost: shouldBeHost,
    ready: false,
    joinedAt: now,
    lastSeenAt: now,
    questionsAsked: 0,
    theoriesSubmitted: 0,
    score: shouldBeHost ? 3 : 0
  };

  if (shouldBeHost) {
    session.players.forEach((member) => {
      member.isHost = false;
    });
  }

  session.players.push(player);
  return { player, joined: true };
}

export function touchPlayer(session: SessionData, playerId: string): SessionPlayer | null {
  const player = session.players.find((item) => item.id === playerId);
  if (!player) return null;
  player.lastSeenAt = Date.now();
  return player;
}

export function setPlayerReady(
  session: SessionData,
  playerId: string,
  ready: boolean
): SessionPlayer | null {
  const player = touchPlayer(session, playerId);
  if (!player) return null;
  player.ready = ready;
  return player;
}

export function bumpPlayerScore(
  session: SessionData,
  playerId: string,
  delta: number
): SessionPlayer | null {
  const player = touchPlayer(session, playerId);
  if (!player) return null;
  player.score += delta;
  return player;
}

export function addQuestionStat(session: SessionData, playerId: string): SessionPlayer | null {
  const player = touchPlayer(session, playerId);
  if (!player) return null;
  player.questionsAsked += 1;
  player.score += 1;
  return player;
}

export function addTheoryStat(session: SessionData, playerId: string): SessionPlayer | null {
  const player = touchPlayer(session, playerId);
  if (!player) return null;
  player.theoriesSubmitted += 1;
  player.score += 2;
  return player;
}

export function addHistoryTurn(
  session: SessionData,
  turn: Omit<ChatTurn, "id" | "createdAt">
): ChatTurn {
  const record: ChatTurn = {
    id: createRecordId("turn"),
    createdAt: Date.now(),
    ...turn
  };

  session.history.push(record);
  if (session.history.length > HISTORY_LIMIT) {
    session.history = session.history.slice(-HISTORY_LIMIT);
  }
  session.updatedAt = Date.now();
  return record;
}

export function addSessionEvent(
  session: SessionData,
  event: Omit<SessionEvent, "id" | "createdAt">
): SessionEvent {
  const record: SessionEvent = {
    id: createRecordId("event"),
    createdAt: Date.now(),
    ...event
  };

  session.events.push(record);
  if (session.events.length > EVENT_LIMIT) {
    session.events = session.events.slice(-EVENT_LIMIT);
  }
  session.updatedAt = Date.now();
  return record;
}

export function markSolved(session: SessionData, summary: string): void {
  session.phase = "solved";
  session.solvedAt = Date.now();
  session.solutionSummary = summary;
  session.updatedAt = Date.now();
}

export function buildSessionPayload(session: SessionData, soup: VisibleSoup) {
  const now = Date.now();
  const players = [...session.players]
    .sort((left, right) => {
      if (left.isHost !== right.isHost) return left.isHost ? -1 : 1;
      if (left.ready !== right.ready) return left.ready ? -1 : 1;
      return left.joinedAt - right.joinedAt;
    })
    .map((player) => {
      const online = now - player.lastSeenAt < ONLINE_WINDOW_MS;
      return {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        ready: player.ready,
        online,
        joinedAt: new Date(player.joinedAt).toISOString(),
        lastSeenAt: new Date(player.lastSeenAt).toISOString(),
        questionsAsked: player.questionsAsked,
        theoriesSubmitted: player.theoriesSubmitted,
        score: player.score,
        statusLabel: online ? (player.ready ? "在线 / 已准备" : "在线") : "暂时离开"
      };
    });

  return {
    sessionId: session.id,
    phase: session.phase,
    soup,
    players,
    history: session.history.map((turn) => ({
      ...turn,
      createdAt: new Date(turn.createdAt).toISOString()
    })),
    events: session.events.map((event) => ({
      ...event,
      createdAt: new Date(event.createdAt).toISOString()
    })),
    createdAt: new Date(session.createdAt).toISOString(),
    lastUpdated: new Date(session.updatedAt).toISOString(),
    solvedAt: session.solvedAt ? new Date(session.solvedAt).toISOString() : undefined,
    solutionSummary: session.solutionSummary,
    metrics: {
      onlinePlayers: players.filter((player) => player.online).length,
      readyPlayers: players.filter((player) => player.ready).length,
      questions: session.players.reduce((sum, player) => sum + player.questionsAsked, 0),
      theories: session.players.reduce((sum, player) => sum + player.theoriesSubmitted, 0)
    }
  };
}

export async function loadSession(
  env: SessionEnv | undefined,
  id: string
): Promise<SessionData | null> {
  if (!env?.SESSIONS_KV) {
    return memorySessions.has(id) ? cloneSession(memorySessions.get(id)!) : null;
  }

  const stored = await env.SESSIONS_KV.get(SESSION_PREFIX + id, { type: "json" });
  if (!stored) return null;
  return stored as SessionData;
}

export async function saveSession(
  env: SessionEnv | undefined,
  session: SessionData
): Promise<void> {
  session.updatedAt = Date.now();

  if (!env?.SESSIONS_KV) {
    memorySessions.set(session.id, cloneSession(session));
    return;
  }

  await env.SESSIONS_KV.put(SESSION_PREFIX + session.id, JSON.stringify(session));
}

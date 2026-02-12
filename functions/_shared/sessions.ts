import type { ChatCompletionMessageRole } from "./types";

export type ChatRole = Exclude<ChatCompletionMessageRole, "system">;

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface SessionData {
  id: string;
  soupId: string;
  createdAt: number;
  history: ChatTurn[];
}

const SESSION_PREFIX = "session:";

export async function loadSession(env: any, id: string): Promise<SessionData | null> {
  if (!env || !env.SESSIONS_KV) return null;
  const stored = await env.SESSIONS_KV.get(SESSION_PREFIX + id, { type: "json" });
  if (!stored) return null;
  return stored as SessionData;
}

export async function saveSession(env: any, session: SessionData): Promise<void> {
  if (!env || !env.SESSIONS_KV) {
    throw new Error("SESSIONS_KV binding is not configured");
  }
  await env.SESSIONS_KV.put(SESSION_PREFIX + session.id, JSON.stringify(session));
}

export function createEmptySession(id: string, soupId: string): SessionData {
  return {
    id,
    soupId,
    createdAt: Date.now(),
    history: []
  };
}


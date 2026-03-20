import type {
  PlayerIdentity,
  SessionInfo,
  TurtleSoupDetail,
  TurtleSoupSummary
} from "../types";

export type AskMode = "question" | "hint" | "progress" | "theory";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL && (import.meta as any).env.VITE_API_BASE_URL !== ""
    ? (import.meta as any).env.VITE_API_BASE_URL
    : "/api";

const requestCache = new Map<string, Promise<any>>();
const responseCache = new Map<string, any>();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE + path;
  const method = init?.method ?? "GET";
  const cacheKey = `${method}:${url}`;

  if (method === "GET" && requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey) as Promise<T>;
  }

  const promise = (async () => {
    const response = await fetch(url, {
      ...init,
      headers: new Headers({
        "Content-Type": "application/json",
        ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {})
      })
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
        if (data?.error && !data?.message) message = data.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = (await response.json()) as T;
    if (method === "GET") {
      responseCache.set(cacheKey, data);
    }
    return data;
  })();

  if (method === "GET") {
    requestCache.set(cacheKey, promise);
    promise.finally(() => {
      requestCache.delete(cacheKey);
    });
  }

  return promise;
}

export async function fetchSoups(): Promise<TurtleSoupSummary[]> {
  return request<TurtleSoupSummary[]>("/turtle-soups");
}

export async function fetchSoupDetail(id: string): Promise<TurtleSoupDetail> {
  return request<TurtleSoupDetail>(`/turtle-soups/${id}`);
}

export async function createSession(
  soupId: string,
  player: PlayerIdentity
): Promise<SessionInfo> {
  return request<SessionInfo>("/sessions", {
    method: "POST",
    body: JSON.stringify({ soupId, player })
  });
}

export async function fetchSession(sessionId: string): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}`);
}

export async function joinSession(
  sessionId: string,
  player: PlayerIdentity
): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}/join`, {
    method: "POST",
    body: JSON.stringify(player)
  });
}

export async function updatePresence(
  sessionId: string,
  player: PlayerIdentity
): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}/presence`, {
    method: "POST",
    body: JSON.stringify({
      playerId: player.id,
      playerName: player.name
    })
  });
}

export async function updateReadyState(
  sessionId: string,
  playerId: string,
  ready: boolean
): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}/ready`, {
    method: "POST",
    body: JSON.stringify({ playerId, ready })
  });
}

export async function askInSession(
  sessionId: string,
  payload: {
    question: string;
    player: PlayerIdentity;
    mode?: AskMode;
  }
): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}/ask`, {
    method: "POST",
    body: JSON.stringify({
      question: payload.question,
      playerId: payload.player.id,
      playerName: payload.player.name,
      mode: payload.mode ?? "question"
    })
  });
}

export async function fetchSessionLatest(sessionId: string): Promise<SessionInfo> {
  const cacheKey = `GET:${API_BASE}/sessions/${sessionId}`;
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey) as SessionInfo;
  }
  return fetchSession(sessionId);
}

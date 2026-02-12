import type {
  ChatTurn,
  TurtleSoupDetail,
  TurtleSoupSummary,
  SessionInfo
} from "../types";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL && (import.meta as any).env.VITE_API_BASE_URL !== ""
    ? (import.meta as any).env.VITE_API_BASE_URL
    : "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(API_BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    ...init
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const data = await resp.json();
      if (data?.message) msg = data.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await resp.json()) as T;
}

export async function fetchSoups(): Promise<TurtleSoupSummary[]> {
  return request<TurtleSoupSummary[]>("/turtle-soups");
}

export async function fetchSoupDetail(id: string): Promise<TurtleSoupDetail> {
  return request<TurtleSoupDetail>(`/turtle-soups/${id}`);
}

export async function createSession(soupId: string): Promise<SessionInfo> {
  return request<SessionInfo>("/sessions", {
    method: "POST",
    body: JSON.stringify({ soupId })
  });
}

export async function fetchSession(sessionId: string): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}`);
}

export async function askInSession(
  sessionId: string,
  question: string
): Promise<{ answer: string; history: ChatTurn[] }> {
  return request<{ answer: string; history: ChatTurn[] }>(
    `/sessions/${sessionId}/ask`,
    {
      method: "POST",
      body: JSON.stringify({ question })
    }
  );
}


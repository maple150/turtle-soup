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

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>();
const etagCache = new Map<string, string>();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE + path;

  // Check for in-flight request (deduplication)
  const cacheKey = `${init?.method || 'GET'}:${url}`;
  if (init?.method !== 'POST' && requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey) as Promise<T>;
  }

  // Prepare request with ETag support for conditional requests
  const etag = etagCache.get(cacheKey);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers || {})
  };

  if (etag && !init?.body) {
    headers['If-None-Match'] = etag;
  }

  const requestPromise = (async () => {
    const resp = await fetch(url, {
      ...init,
      headers
    });

    // Store ETag for future requests
    const newEtag = resp.headers.get('ETag');
    if (newEtag) {
      etagCache.set(cacheKey, newEtag);
    }

    // Handle 304 Not Modified
    if (resp.status === 304) {
      // Return cached data or empty result
      return {} as T;
    }

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
  })();

  // Cache non-POST requests
  if (init?.method !== 'POST') {
    requestCache.set(cacheKey, requestPromise);

    // Clear cache after request completes
    requestPromise.finally(() => {
      requestCache.delete(cacheKey);
    });
  }

  return requestPromise;
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

// Optimized method for polling - only returns essential data
export async function fetchSessionLatest(sessionId: string): Promise<SessionInfo> {
  return request<SessionInfo>(`/sessions/${sessionId}`);
}


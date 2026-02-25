import React, { useEffect, useMemo, useState } from "react";
import type { ChatTurn, TurtleSoupDetail, TurtleSoupSummary } from "./types";
import {
  askInSession,
  createSession,
  fetchSession,
  fetchSoupDetail,
  fetchSoups
} from "./api/client";

type Status = "idle" | "loading" | "error" | "ok";

const difficultyLabel = (d: number) => {
  if (d <= 1) return "新手";
  if (d === 2) return "入门";
  if (d === 3) return "进阶";
  if (d === 4) return "困难";
  return "地狱";
};

const difficultyClass = (d: number) => {
  if (d <= 2) return "";
  if (d === 3) return "medium";
  return "hard";
};

const App: React.FC = () => {
  const [soups, setSoups] = useState<TurtleSoupSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TurtleSoupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);

  const [apiStatus, setApiStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchSoups();
        setSoups(list);
      } catch (e: any) {
        setApiStatus("error");
        setError(e?.message ?? "加载题库失败");
      }
    })();
  }, []);

  // 如果 URL 中带有 ?session=xxx，则尝试加入现有房间
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sid = url.searchParams.get("session");
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  // 加载已有 session（用于第二个玩家通过链接加入）
  useEffect(() => {
    if (!sessionId) return;
    setLoadingDetail(true);
    setError(null);
    (async () => {
      try {
        const info = await fetchSession(sessionId);
        setSelectedId(info.soup.id);
        setDetail(info.soup);
        setChat(info.history);
        setApiStatus("ok");
      } catch (e: any) {
        setError(e?.message ?? "房间不存在或已过期，请确认链接是否正确。");
        setApiStatus("error");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [sessionId]);

  // 当选择题目但尚未创建房间时，本地加载题目详情用于展示
  useEffect(() => {
    if (!selectedId) {
      if (!sessionId) {
        setDetail(null);
        setChat([]);
      }
      return;
    }
    if (sessionId) return; // 已有房间时，详情和聊天由 session 控制

    setLoadingDetail(true);
    setError(null);
    (async () => {
      try {
        const d = await fetchSoupDetail(selectedId);
        setDetail(d);
        setChat([
          {
            role: "assistant",
            content:
              "欢迎来到海龟汤推理室，我是主持人「汤神小千」。请选择或创建房间后再开始发问。"
          }
        ]);
      } catch (e: any) {
        setError(e?.message ?? "加载题目失败");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selectedId, sessionId]);

  const canAsk = useMemo(
    () => !!sessionId && input.trim().length > 0 && !asking,
    [sessionId, input, asking]
  );

  async function handleAsk(customQuestion?: string) {
    if (!sessionId || asking) return;
    const question = (customQuestion ?? input).trim();
    if (!question) return;

    setAsking(true);
    setError(null);

    const nextChat: ChatTurn[] = [...chat, { role: "user", content: question }];
    setChat(nextChat);
    setInput("");

    try {
      const { answer, history } = await askInSession(sessionId, question);
      // 以服务端为准，避免多人时本地状态不一致
      setChat(history.length ? history : [...nextChat, { role: "assistant", content: answer }]);

      // 如果是进度查询，则解析百分比并更新进度条
      if (question === "进度") {
        const match = answer.match(/进度：(\d+)%/);
        if (match) {
          const value = Math.max(0, Math.min(100, parseInt(match[1], 10)));
          setProgress(value);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "主持人暂时失联了，请稍后再试。");
    } finally {
      setAsking(false);
    }
  }

  function handleQuickHint() {
    handleAsk("我有点卡住了，请给我一个不剧透的提示。");
  }

  const currentSoup = useMemo(
    () => soups.find((s) => s.id === selectedId) ?? null,
    [soups, selectedId]
  );

  const shareUrl = useMemo(() => {
    if (!sessionId || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("session", sessionId);
    return url.toString();
  }, [sessionId]);

  async function handleCreateSessionForSoup(soupId: string) {
    try {
      setError(null);
      const info = await createSession(soupId);
      setSessionId(info.sessionId);
      setSelectedId(info.soup.id);
      setDetail(info.soup);
      setChat(info.history);
      setApiStatus("ok");

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("session", info.sessionId);
        window.history.replaceState(null, "", url.toString());
      }
    } catch (e: any) {
      setError(e?.message ?? "创建房间失败，请稍后重试。");
    }
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="brand">
          <div className="brand-logo">汤</div>
          <div>
            <div className="brand-text-main">海龟汤</div>
            <div className="brand-text-sub">AI 主持人陪你一起脑洞推理</div>
          </div>
        </div>
        <div className="shell-header-right">
          <div className="chip">
            <span className="chip-dot" />
            <span>Powered by 通义千问</span>
          </div>
        </div>
      </header>

      <main className="shell-body">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-title">题库 / 房间列表</div>
              <div className="panel-subtitle">选一碗你想喝的汤，再开始发问</div>
            </div>
            <div className="panel-meta">
              <span className="pill">共 {soups.length} 题</span>
            </div>
          </div>
          <div className="panel-body">
            <div className="soup-list">
              {soups.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={
                    "soup-item fade-in" + (s.id === selectedId ? " selected" : "")
                  }
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="soup-title-row">
                    <div className="soup-title">{s.title}</div>
                    <div className="soup-difficulty">
                      <span
                        className={
                          "difficulty-dot " + difficultyClass(s.difficulty)
                        }
                      />
                      <span>{difficultyLabel(s.difficulty)}</span>
                    </div>
                  </div>
                  <div className="soup-tags">
                    {(s.tags ?? []).map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="soup-opening-preview">{s.opening}</div>
                </button>
              ))}
              {soups.length === 0 && (
                <div className="panel-subtitle">
                  {apiStatus === "error"
                    ? "题库加载失败，请检查后端是否已部署。"
                    : "正在加载题库……"}
                </div>
              )}
            </div>
            <div className="opening-card">
              <div className="opening-title">
                {currentSoup
                  ? `当前题目：${currentSoup.title}`
                  : "请选择左侧的一道海龟汤题目"}
              </div>
              <div>
                {currentSoup
                  ? currentSoup.opening
                  : "选中题目后，你只会看到这段开局描述。真相只有主持人和出题人知道。"}
              </div>
              {selectedId && !sessionId && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 11
                  }}
                >
                  <span style={{ color: "#9ca3af" }}>
                    想和朋友一起玩？先为这道题创建一个房间。
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleCreateSessionForSoup(selectedId)}
                  >
                    创建房间
                  </button>
                </div>
              )}
              {sessionId && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#9ca3af",
                    wordBreak: "break-all"
                  }}
                >
                  房间已创建，可把这个链接发给朋友一起玩：
                  <br />
                  <span>{shareUrl}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-title">对话 / 推理区</div>
              <div className="panel-subtitle">
                用「是 / 否 / 无关 / 无法确定」问答的方式，一步步逼近真相
              </div>
            </div>
            {progress !== null && (
              <div className="panel-meta">
                <div className="progress-pill">
                  <span className="progress-label">推理进度</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="progress-value">{progress}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="panel-body chat-container">
            <div className="chat-log">
              {detail && (
                <div className="chat-message host">
                  <div className="chat-bubble host fade-in">
                    <div className="chat-meta">系统提示</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      当前题目难度：{difficultyLabel(detail.difficulty)}。
                      请避免直接问「真相是什么」，可以从人物、动机、时间线、地点等角度逐步缩小范围。
                    </div>
                  </div>
                </div>
              )}
              {chat.map((m, idx) => (
                <div
                  key={idx}
                  className={"chat-message " + (m.role === "user" ? "user" : "host")}
                >
                  <div
                    className={
                      "chat-bubble fade-in " +
                      (m.role === "user" ? "user" : "host")
                    }
                  >
                    <div className="chat-meta">
                      {m.role === "user" ? "你" : "主持人"}
                    </div>
                    <div>{m.content}</div>
                  </div>
                </div>
              ))}
              {!selectedId && (
                <div className="chat-message host">
                  <div className="chat-bubble host fade-in">
                    <div className="chat-meta">主持人</div>
                    <div>
                      先在左侧选一道你感兴趣的题目吧～ 选好之后，就可以开始用各种刁钻问题来拷问我了。
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-area">
              <div className="chat-input-box">
                <textarea
                  className="chat-textarea"
                  placeholder={
                    sessionId
                      ? "例如：他是被别人害死的吗？这和天气有关吗？"
                      : "请先在左侧选择一题海龟汤～"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canAsk) {
                        void handleAsk();
                      }
                    }
                  }}
                  disabled={!sessionId || asking}
                  rows={2}
                />
                <div className="chat-input-hint">Enter 发送 · Shift+Enter 换行</div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canAsk}
                onClick={() => handleAsk()}
              >
                {asking ? "主持人思考中..." : "发送问题"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!sessionId || asking}
                onClick={handleQuickHint}
              >
                要个提示
              </button>
            </div>
            {error && (
              <div
                style={{
                  fontSize: 11,
                  color: "#fb7185",
                  marginTop: 2
                }}
              >
                {error}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="status-text">
          <span
            className={
              "status-dot " +
              (apiStatus === "error"
                ? "error"
                : apiStatus === "ok"
                ? "ok"
                : "")
            }
          />
          <span>
            {apiStatus === "error"
              ? "后端连接异常，请检查 Cloudflare Worker 是否已部署。"
              : apiStatus === "ok"
              ? "已连接到海龟汤主持人。"
              : "正在连接题库..."}
          </span>
        </div>
        <div>你可以把这个项目直接推到 GitHub，然后用 Cloudflare Pages + Workers 部署。</div>
      </footer>
    </div>
  );
};

export default App;


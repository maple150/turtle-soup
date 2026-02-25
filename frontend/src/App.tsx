import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChatTurn,
  TurtleSoupSummary,
  TurtleSoupDetail,
} from "./types";
import {
  askInSession,
  createSession,
  fetchSession,
  fetchSoups,
} from "./api/client";
import "./styles/theme.css";

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
  const [currentSoup, setCurrentSoup] = useState<TurtleSoupDetail | null>(
    null
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const [apiStatus, setApiStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // 自动滚动 & 未读消息提示
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [userNearBottom, setUserNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // 简单轮询同步状态
  const [connectionState, setConnectionState] = useState<
    "idle" | "connecting" | "online" | "error"
  >("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const POLL_INTERVAL_MS = 3000;

  // 加载题库
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchSoups();
        setSoups(list);
        setApiStatus("ok");
      } catch (e: any) {
        setApiStatus("error");
        setError(e?.message ?? "加载题库失败");
      }
    })();
  }, []);

  // URL 中带 session 时自动加入房间
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sid = url.searchParams.get("session");
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  // 加载已有房间
  useEffect(() => {
    if (!sessionId) return;
    setConnectionState("connecting");
    (async () => {
      try {
        const info = await fetchSession(sessionId);
        setSelectedId(info.soup.id);
        setCurrentSoup(info.soup);
        setChat(info.history);
        setConnectionState("online");
        setLastSyncAt(Date.now());
        setApiStatus("ok");
      } catch (e: any) {
        setError(e?.message ?? "房间不存在或已过期，请确认链接是否正确。");
        setConnectionState("error");
        setApiStatus("error");
      }
    })();
  }, [sessionId]);

  // 当选择题目但尚未创建房间时，只用于展示开局描述
  useEffect(() => {
    if (!selectedId) {
      if (!sessionId) {
        setCurrentSoup(null);
        setChat([]);
      }
      return;
    }

    const found = soups.find((s) => s.id === selectedId);
    if (found) {
      setCurrentSoup(found);
      if (!sessionId) {
        setChat([
          {
            role: "assistant",
            content:
              "欢迎来到海龟汤推理室，我是主持人「汤神小千」。请为这道题创建房间后再开始发问。",
          },
        ]);
      }
    }
  }, [selectedId, sessionId, soups]);

  // 简单轮询：多人同步
  useEffect(() => {
    if (!sessionId) return;
    let timer: number | null = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const info = await fetchSession(sessionId);
        setCurrentSoup(info.soup);
        setSelectedId(info.soup.id);
        setChat((prev) => {
          // 如果长度不同就直接替换
          if (prev.length !== info.history.length) {
            // 如果用户不在底部，增加未读数
            if (!userNearBottom && info.history.length > prev.length) {
              setUnreadCount((c) => c + (info.history.length - prev.length));
            }
            return info.history;
          }
          return prev;
        });
        setConnectionState("online");
        setLastSyncAt(Date.now());
      } catch {
        setConnectionState("error");
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(tick, POLL_INTERVAL_MS);
        }
      }
    };

    timer = window.setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionId, userNearBottom]);

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
      setChat(history.length ? history : [...nextChat, { role: "assistant", content: answer }]);

      // 解析进度
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

  // 自动滚动到最新
  useEffect(() => {
    if (!chatEndRef.current) return;
    if (userNearBottom) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      setUnreadCount(0);
    } else {
      // 用户停留在历史时，新消息只提示
      setUnreadCount((c) => c + 1);
    }
  }, [chat, userNearBottom]);

  // 监听滚动判断是否在底部
  function handleChatScroll() {
    const el = chatContainerRef.current;
    if (!el) return;
    const distance =
      el.scrollHeight - (el.scrollTop + el.clientHeight);
    const nearBottom = distance < 40;
    setUserNearBottom(nearBottom);
    if (nearBottom) setUnreadCount(0);
  }

  const shareUrl = useMemo(() => {
    if (!sessionId || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("session", sessionId);
    return url.toString();
  }, [sessionId]);

  async function handleCreateSession() {
    if (!selectedId) return;
    try {
      setError(null);
      const info = await createSession(selectedId);
      setSessionId(info.sessionId);
      setCurrentSoup(info.soup);
      setChat(info.history);
      setApiStatus("ok");
      setConnectionState("online");
      setLastSyncAt(Date.now());

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("session", info.sessionId);
        window.history.replaceState(null, "", url.toString());
      }
    } catch (e: any) {
      setError(e?.message ?? "创建房间失败，请稍后重试。");
    }
  }

  const currentStatusText = useMemo(() => {
    if (connectionState === "online" && lastSyncAt) {
      const diffSec = Math.floor((Date.now() - lastSyncAt) / 1000);
      const ago =
        diffSec < 10
          ? "刚刚"
          : diffSec < 60
          ? `${diffSec}s 前`
          : `${Math.floor(diffSec / 60)} 分钟前`;
      return `已连接 · 上次同步 ${ago}`;
    }
    if (connectionState === "connecting") return "连接中...";
    if (connectionState === "error") return "连接异常";
    return "未连接房间";
  }, [connectionState, lastSyncAt]);

  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-logo">汤</div>
          <div>
            <div className="brand-text-main">海龟汤 · 通义千问版</div>
            <div className="brand-text-sub">
              AI 主持人与多人实时推理房间
            </div>
          </div>
        </div>
        <div className="top-bar-right">
          <div className="chip">
            <span className="chip-dot" />
            <span>Powered by 通义千问</span>
          </div>
          <div className="chip connection-chip">
            <span
              className={
                "status-dot " +
                (connectionState === "online"
                  ? "ok"
                  : connectionState === "error"
                  ? "error"
                  : "")
              }
            />
            <span className="connection-text">{currentStatusText}</span>
          </div>
        </div>
      </header>

      <main className="content">
        {/* 左侧：题库与房间 */}
        <section className="pane pane-left">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-title">题库 / 房间</div>
                <div className="panel-subtitle">
                  选一碗汤，创建房间，与朋友共享同一局
                </div>
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
                      "soup-item slide-in" +
                      (s.id === selectedId ? " selected" : "")
                    }
                    onClick={() => {
                      setSelectedId(s.id);
                      setProgress(null);
                    }}
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
                      ? "题库加载失败，请检查后端。"
                      : "正在加载题库..."}
                  </div>
                )}
              </div>

              <div className="opening-card">
                <div className="opening-title">
                  {currentSoup
                    ? `当前题目：${currentSoup.title}`
                    : "请选择一题海龟汤"}
                </div>
                <div>
                  {currentSoup
                    ? currentSoup.opening
                    : "选中题目后，你只会看到这段开局描述。真相只有主持人和出题人知道。"}
                </div>
                <div className="room-actions">
                  {selectedId && !sessionId && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreateSession}
                    >
                      创建房间并开始这局
                    </button>
                  )}
                  {sessionId && (
                    <div className="room-link">
                      <div className="room-link-label">
                        房间已创建，把链接发给朋友一起玩：
                      </div>
                      <div className="room-link-value">{shareUrl}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 右侧：聊天 */}
        <section className="pane pane-right">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-title">对话 / 推理区</div>
                <div className="panel-subtitle">
                  只能用「是 / 否 / 无关 / 无法确定」来问出真相
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
              <div
                className="chat-log"
                ref={chatContainerRef}
                onScroll={handleChatScroll}
              >
                {currentSoup && (
                  <div className="chat-bubble-wrapper host slide-in">
                    <div className="chat-bubble">
                      <div className="chat-meta">系统提示</div>
                      <div className="chat-content">
                        当前题目难度：{difficultyLabel(currentSoup.difficulty)}。
                        建议从人物、动机、时间线等角度慢慢缩小范围，避免直接问“真相是什么”。
                      </div>
                    </div>
                  </div>
                )}

                {chat.map((m, idx) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={idx}
                      className={
                        "chat-bubble-wrapper slide-in " +
                        (isUser ? "user" : "host")
                      }
                      style={{
                        animationDelay: `${idx * 40}ms`,
                      }}
                    >
                      <div className="chat-bubble">
                        <div className="chat-meta">
                          {isUser ? "你" : "主持人"}
                        </div>
                        <div className="chat-content">{m.content}</div>
                      </div>
                    </div>
                  );
                })}

                {!selectedId && chat.length === 0 && (
                  <div className="chat-bubble-wrapper host slide-in">
                    <div className="chat-bubble">
                      <div className="chat-meta">主持人</div>
                      <div className="chat-content">
                        先在左侧选一道你感兴趣的题目吧～
                        选好并创建房间后，就可以开始用各种刁钻问题来拷问我了。
                      </div>
                    </div>
                  </div>
                )}

                {asking && (
                  <div className="chat-bubble-wrapper host slide-in">
                    <div className="chat-bubble">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  className="message-indicator"
                  onClick={() => {
                    setUserNearBottom(true);
                    setUnreadCount(0);
                    if (chatEndRef.current) {
                      chatEndRef.current.scrollIntoView({
                        behavior: "smooth",
                        block: "end",
                      });
                    }
                  }}
                >
                  <span className="message-count">{unreadCount}</span>
                  <span className="message-text">条新消息，点击查看</span>
                </button>
              )}

              <div className="chat-input-area">
                <div className="chat-input-box">
                  <textarea
                    className="chat-textarea"
                    placeholder={
                      sessionId
                        ? "例如：他是被别人害死的吗？这和天气有关吗？（输入“进度”可以查看百分比）"
                        : "请先在左侧选择一题并创建房间～"
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (canAsk) void handleAsk();
                      }
                    }}
                    disabled={!sessionId || asking}
                    rows={2}
                  />
                  <div className="chat-input-hint">
                    Enter 发送 · Shift+Enter 换行
                  </div>
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
                    marginTop: 4,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bottom-bar">
        <span>
          前端已为桌面和手机浏览器自适应，你可以在任意设备上上下滑动正常游玩。
        </span>
      </footer>
    </div>
  );
};

export default App;

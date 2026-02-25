import React, { useEffect, useMemo, useState } from "react";
import type { ChatTurn, TurtleSoupDetail, TurtleSoupSummary } from "./types";
import {
  askInSession,
  createSession,
  fetchSession,
  fetchSoupDetail,
  fetchSoups
} from "./api/client";
import { useAutoScroll } from "./hooks/useAutoScroll";
import { useMobileLayout, ActivePanel } from "./hooks/useMobileLayout";
import { usePollingSession } from "./hooks/usePollingSession";
import { ChatBubble } from "./components/ChatBubble";
import { MessageIndicator } from "./components/MessageIndicator";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { MobileHeader } from "./components/MobileHeader";
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
  const [detail, setDetail] = useState<TurtleSoupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);

  const [apiStatus, setApiStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mobile layout hook
  const { isMobile, activePanel, setActivePanel, togglePanel } = useMobileLayout();

  // Auto-scroll hook
  const { chatLogRef, scrollPosition, scrollToBottom, manualScroll } = useAutoScroll({
    threshold: 100,
    smooth: true,
    autoScrollOnNewMessage: true
  });

  // Handle session updates from polling
  const handleSessionUpdate = (updatedSession: { soup: TurtleSoupDetail; history: ChatTurn[] }) => {
    const previousLength = chat.length;
    const newLength = updatedSession.history.length;

    // Update chat history
    setChat(updatedSession.history);
    setDetail(updatedSession.soup);

    // Calculate unread messages if user is not at bottom
    if (previousLength < newLength && !scrollPosition.isNearBottom) {
      setUnreadCount(newLength - previousLength);
    }

    setApiStatus("ok");
  };

  // Handle scroll events
  const handleScroll = () => {
    manualScroll();
    if (scrollPosition.isNearBottom) {
      setUnreadCount(0);
    }
  };

  // Handle message indicator click
  const handleScrollToBottom = () => {
    scrollToBottom(true);
    setUnreadCount(0);
  };

  // Real-time polling for multiplayer sync
  const {
    isConnected,
    isPolling,
    lastSyncTime,
    connectionState,
    pollInterval,
    retryCount,
    forceSync
  } = usePollingSession({
    sessionId,
    onUpdate: handleSessionUpdate,
    onError: (err) => setError(err.message)
  });

  // Load soups list
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

  // Parse session ID from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sid = url.searchParams.get("session");
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  // Load existing session
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

        // Auto-switch to chat panel on mobile when joining a session
        if (isMobile) {
          setActivePanel('chat');
        }
      } catch (e: any) {
        setError(e?.message ?? "房间不存在或已过期，请确认链接是否正确。");
        setApiStatus("error");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [sessionId, isMobile, setActivePanel]);

  // Load soup detail when selected (not in session)
  useEffect(() => {
    if (!selectedId) {
      if (!sessionId) {
        setDetail(null);
        setChat([]);
      }
      return;
    }
    if (sessionId) return;

    setLoadingDetail(true);
    setError(null);
    (async () => {
      try {
        const d = await fetchSoupDetail(selectedId);
        setDetail(d);
        setChat([
          {
            role: "assistant",
            content: "欢迎来到海龟汤推理室，我是主持人「汤神小千」。请选择或创建房间后再开始发问。"
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
      setChat(history.length ? history : [...nextChat, { role: "assistant", content: answer }]);

      // Auto-scroll to bottom on new message
      scrollToBottom(true);

      // Parse progress if querying
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

      // Switch to chat panel on mobile after creating session
      if (isMobile) {
        setActivePanel('chat');
      }

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("session", info.sessionId);
        window.history.replaceState(null, "", url.toString());
      }
    } catch (e: any) {
      setError(e?.message ?? "创建房间失败，请稍后重试。");
    }
  }

  function handleSelectSoup(soupId: string) {
    setSelectedId(soupId);
    if (isMobile) {
      setActivePanel('list');
    }
  }

  return (
    <div className="app-root">
      {isMobile && (
        <MobileHeader
          title={currentSoup?.title || '海龟汤'}
          connectionState={connectionState}
          lastSyncTime={lastSyncTime}
          pollInterval={pollInterval}
          retryCount={retryCount}
          onMenuToggle={togglePanel}
          showBackButton={activePanel === 'chat'}
          onBack={() => setActivePanel('list')}
          activePanel={activePanel}
        />
      )}

      <div className="shell">
        {!isMobile && (
          <header className="shell-header">
            <div className="brand">
              <div className="brand-logo">汤</div>
              <div>
                <div className="brand-text-main">海龟汤</div>
                <div className="brand-text-sub">AI 主持人陪你一起脑洞推理</div>
              </div>
            </div>
            <div className="shell-header-right">
              {sessionId && isConnected && (
                <ConnectionStatus
                  state={connectionState}
                  lastSyncTime={lastSyncTime}
                  pollInterval={pollInterval}
                  retryCount={retryCount}
                />
              )}
              <div className="chip">
                <span className="chip-dot" />
                <span>Powered by 通义千问</span>
              </div>
            </div>
          </header>
        )}

        <main className="shell-body">
          {/* Soup List Panel */}
          <section className={`panel ${isMobile && activePanel !== 'list' ? 'hidden' : ''}`}>
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
                      "soup-item slide-in" + (s.id === selectedId ? " selected" : "")
                    }
                    onClick={() => handleSelectSoup(s.id)}
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

          {/* Chat Panel */}
          <section className={`panel ${isMobile && activePanel !== 'chat' ? 'hidden' : ''}`}>
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
              <div
                ref={chatLogRef}
                className="chat-log"
                onScroll={handleScroll}
              >
                {detail && (
                  <div className="chat-bubble-wrapper">
                    <div className="chat-bubble host slide-in">
                      <div className="chat-meta">系统提示</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        当前题目难度：{difficultyLabel(detail.difficulty)}。
                        请避免直接问「真相是什么」，可以从人物、动机、时间线、地点等角度逐步缩小范围。
                      </div>
                    </div>
                  </div>
                )}
                {chat.map((m, idx) => (
                  <ChatBubble
                    key={idx}
                    message={m}
                    index={idx}
                    isVisible={true}
                  />
                ))}
                {!selectedId && (
                  <div className="chat-bubble-wrapper">
                    <div className="chat-bubble host slide-in">
                      <div className="chat-meta">主持人</div>
                      <div>
                        先在左侧选一道你感兴趣的题目吧～ 选好之后，就可以开始用各种刁钻问题来拷问我了。
                      </div>
                    </div>
                  </div>
                )}
                {asking && (
                  <div className="chat-bubble-wrapper">
                    <div className="chat-bubble host slide-in">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <MessageIndicator
                count={unreadCount}
                onClick={handleScrollToBottom}
              />

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
                    rows={isMobile ? 3 : 2}
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

        {!isMobile && (
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
        )}
      </div>
    </div>
  );
};

export default App;

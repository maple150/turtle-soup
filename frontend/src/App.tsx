import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/theme.css";
import {
  askInSession,
  createSession,
  fetchSession,
  fetchSoups,
  joinSession,
  updatePresence,
  updateReadyState,
  type AskMode
} from "./api/client";
import type {
  ChatTurn,
  PlayerIdentity,
  SessionEvent,
  SessionInfo,
  SessionPlayer,
  SessionPhase,
  TurtleSoupSummary
} from "./types";

const PLAYER_STORAGE_KEY = "turtle-soup-player-v3";
const POLL_INTERVAL_MS = 3500;
const PRESENCE_INTERVAL_MS = 15000;

function createPlayerIdentity(name?: string): PlayerIdentity {
  return {
    id:
      crypto.randomUUID?.() ??
      `player_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    name: name?.trim() || `侦探${Math.floor(Math.random() * 900 + 100)}`
  };
}

function loadPlayerIdentity(): PlayerIdentity {
  if (typeof window === "undefined") return createPlayerIdentity();
  try {
    const stored = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!stored) return createPlayerIdentity();
    const parsed = JSON.parse(stored) as PlayerIdentity;
    if (!parsed?.id || !parsed?.name) return createPlayerIdentity();
    return parsed;
  } catch {
    return createPlayerIdentity();
  }
}

function savePlayerIdentity(player: PlayerIdentity): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
}

function phaseLabel(phase: SessionPhase): string {
  if (phase === "lobby") return "集结中";
  if (phase === "playing") return "审汤中";
  return "已揭晓";
}

function difficultyLabel(level: number): string {
  if (level <= 1) return "轻松";
  if (level === 2) return "入门";
  if (level === 3) return "烧脑";
  if (level === 4) return "硬核";
  return "深夜局";
}

function formatTimeLabel(input?: string): string {
  if (!input) return "刚刚";
  const time = new Date(input).getTime();
  if (Number.isNaN(time)) return "刚刚";
  const diff = Date.now() - time;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function toShareUrl(sessionId: string | null): string {
  if (!sessionId || typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  return url.toString();
}

function verdictLabel(turn: ChatTurn): string | null {
  if (!turn.verdict) return null;
  const map: Record<string, string> = {
    yes: "是",
    no: "否",
    irrelevant: "无关",
    uncertain: "无法确定",
    hint: "提示",
    progress: "进度",
    theory: "推理",
    solved: "破解"
  };
  return map[turn.verdict] ?? turn.verdict;
}

function fallbackSoup(soups: TurtleSoupSummary[], selectedId: string | null): TurtleSoupSummary | null {
  if (!soups.length) return null;
  return soups.find((item) => item.id === selectedId) ?? soups[0];
}

const App: React.FC = () => {
  const [soups, setSoups] = useState<TurtleSoupSummary[]>([]);
  const [selectedSoupId, setSelectedSoupId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [player, setPlayer] = useState<PlayerIdentity>(() => loadPlayerIdentity());
  const [draftName, setDraftName] = useState(() => loadPlayerIdentity().name);
  const [input, setInput] = useState("");
  const [composerMode, setComposerMode] = useState<AskMode>("question");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncingIdentity, setSyncingIdentity] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const joinAttemptKeyRef = useRef<string | null>(null);

  const selectedSoup = useMemo(
    () => fallbackSoup(soups, selectedSoupId),
    [soups, selectedSoupId]
  );
  const shareUrl = useMemo(() => toShareUrl(sessionId), [sessionId]);
  const selfPlayer = useMemo(
    () => session?.players.find((member) => member.id === player.id) ?? null,
    [session, player.id]
  );
  const latestProgress = useMemo(() => {
    if (session?.phase === "solved") return 100;
    const found = [...(session?.history ?? [])].reverse().find((turn) => typeof turn.progress === "number");
    return found?.progress ?? Math.min(18 + (session?.metrics.questions ?? 0) * 4, 92);
  }, [session]);

  useEffect(() => {
    savePlayerIdentity(player);
  }, [player]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const found = url.searchParams.get("session");
    if (found) {
      setSessionId(found);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchSoups();
        if (cancelled) return;
        setSoups(list);
        setSelectedSoupId((current) => current ?? list[0]?.id ?? null);
        setStatus("ready");
      } catch (reason: any) {
        if (cancelled) return;
        setStatus("error");
        setError(reason?.message ?? "题库加载失败");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function applySession(next: SessionInfo) {
    setSession((previous) => {
      if (previous && !isAtBottom && next.history.length > previous.history.length) {
        setUnreadCount((count) => count + (next.history.length - previous.history.length));
      }
      return next;
    });
    setSelectedSoupId(next.soup.id);
    setStatus("ready");
  }

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const info = await fetchSession(sessionId);
        if (cancelled) return;
        applySession(info);
        setError(null);
      } catch (reason: any) {
        if (cancelled) return;
        setStatus("error");
        setError(reason?.message ?? "房间读取失败");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session) return;
    if (session.players.some((member) => member.id === player.id)) {
      joinAttemptKeyRef.current = null;
      return;
    }

    const joinKey = `${sessionId}:${player.id}:${player.name}`;
    if (joinAttemptKeyRef.current === joinKey) return;
    joinAttemptKeyRef.current = joinKey;

    (async () => {
      try {
        const joined = await joinSession(sessionId, player);
        applySession(joined);
      } catch (reason: any) {
        setError(reason?.message ?? "加入房间失败");
      }
    })();
  }, [sessionId, session, player]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const next = await fetchSession(sessionId);
        if (!cancelled) {
          applySession(next);
        }
      } catch {
        // Keep polling quietly to preserve room flow.
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      }
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, isAtBottom]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => {
      void updatePresence(sessionId, player)
        .then((next) => {
          applySession(next);
        })
        .catch(() => {
          // Presence is best-effort.
        });
    }, PRESENCE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [sessionId, player]);

  useEffect(() => {
    if (isAtBottom && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      setUnreadCount(0);
    }
  }, [session?.history, isAtBottom]);

  useEffect(() => {
    if (session?.phase === "solved") {
      setComposerMode("question");
    }
  }, [session?.phase]);

  function handleTranscriptScroll() {
    const node = transcriptRef.current;
    if (!node) return;
    const distance = node.scrollHeight - (node.scrollTop + node.clientHeight);
    const nearBottom = distance < 40;
    setIsAtBottom(nearBottom);
    if (nearBottom) setUnreadCount(0);
  }

  function persistIdentityName(): PlayerIdentity {
    const normalized = draftName.trim() || player.name;
    const next = { ...player, name: normalized.slice(0, 20) };
    setPlayer(next);
    setDraftName(next.name);
    return next;
  }

  async function handleIdentitySync() {
    const next = persistIdentityName();
    if (!sessionId) return;

    setSyncingIdentity(true);
    setError(null);
    try {
      const updated = await joinSession(sessionId, next);
      applySession(updated);
    } catch (reason: any) {
      setError(reason?.message ?? "同步身份失败");
    } finally {
      setSyncingIdentity(false);
    }
  }

  async function handleCreateSession() {
    if (!selectedSoup) return;

    setCreating(true);
    setError(null);
    try {
      const nextPlayer = persistIdentityName();
      const created = await createSession(selectedSoup.id, nextPlayer);
      applySession(created);
      setSessionId(created.sessionId);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("session", created.sessionId);
        window.history.replaceState(null, "", url.toString());
      }
    } catch (reason: any) {
      setError(reason?.message ?? "创建房间失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("复制邀请链接失败");
    }
  }

  async function handleShareRoom() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "一起来玩海龟汤",
          text: "房间已经开好，来一起审汤。",
          url: shareUrl
        });
        return;
      } catch {
        // Fall back to copy.
      }
    }
    await handleCopyShare();
  }

  function pushOptimisticTurn(question: string, mode: AskMode, activePlayer: PlayerIdentity) {
    setSession((previous) => {
      if (!previous) return previous;
      const optimistic: ChatTurn = {
        id: `pending_${Date.now()}`,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
        kind: mode === "theory" ? "theory" : mode === "hint" ? "hint" : mode === "progress" ? "progress" : "question",
        playerId: activePlayer.id,
        playerName: activePlayer.name
      };

      return {
        ...previous,
        history: [...previous.history, optimistic]
      };
    });
  }

  async function handleAsk(
    mode: AskMode = composerMode,
    customQuestion?: string
  ) {
    if (!sessionId || asking) return;

    const question = (customQuestion ?? input).trim();
    if (!question) return;

    const nextPlayer = persistIdentityName();
    setAsking(true);
    setError(null);
    pushOptimisticTurn(question, mode, nextPlayer);
    if (!customQuestion) {
      setInput("");
    }

    try {
      const updated = await askInSession(sessionId, {
        question,
        player: nextPlayer,
        mode
      });
      applySession(updated);
      if (mode === "theory") {
        setComposerMode("question");
      }
    } catch (reason: any) {
      setError(reason?.message ?? "主持人暂时失联了");
    } finally {
      setAsking(false);
    }
  }

  async function handleReadyToggle() {
    if (!sessionId || !selfPlayer) return;
    try {
      const updated = await updateReadyState(sessionId, selfPlayer.id, !selfPlayer.ready);
      applySession(updated);
    } catch (reason: any) {
      setError(reason?.message ?? "切换准备状态失败");
    }
  }

  const canSend = Boolean(sessionId && input.trim() && !asking);
  const roomEvents = useMemo(
    () => [...(session?.events ?? [])].reverse().slice(0, 8),
    [session?.events]
  );

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="app-header">
        <div className="brand-panel">
          <div className="brand-kicker">Multiplayer Mystery Room</div>
          <h1>海龟汤协作推理房</h1>
          <p>
            更像一场多人审讯桌游，而不只是一个聊天框。房间、玩家、事件流和主持节奏现在都围绕多人体验重做了。
          </p>
        </div>

        <div className="identity-panel glass-card">
          <div className="identity-label">你的侦探代号</div>
          <div className="identity-row">
            <input
              className="identity-input"
              value={draftName}
              maxLength={20}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="输入一个房间里显示的名字"
            />
            <button
              type="button"
              className="ghost-button"
              onClick={handleIdentitySync}
              disabled={syncingIdentity}
            >
              {syncingIdentity ? "同步中..." : "同步身份"}
            </button>
          </div>
          <div className="identity-meta">
            ID 尾号 {player.id.slice(-6).toUpperCase()}，方便多人房里区分同名玩家。
          </div>
        </div>
      </header>

      <main className="app-main">
        {session ? (
          <>
            <section className="room-hero glass-card">
              <div className="room-hero-main">
                <div className="phase-pill">{phaseLabel(session.phase)}</div>
                <div className="room-code">房间 #{session.sessionId.slice(-6).toUpperCase()}</div>
                <h2>{session.soup.title}</h2>
                <p className="room-opening">{session.soup.opening}</p>
                <div className="room-hero-meta">
                  <span>难度 {difficultyLabel(session.soup.difficulty)}</span>
                  <span>{session.metrics.onlinePlayers} 人在线</span>
                  <span>{session.metrics.questions} 次发问</span>
                  <span>{session.metrics.theories} 次推理</span>
                </div>
              </div>

              <div className="room-hero-actions">
                <button type="button" className="primary-button" onClick={handleShareRoom}>
                  {copied ? "已复制邀请链接" : "邀请朋友入局"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleReadyToggle}
                  disabled={!selfPlayer}
                >
                  {selfPlayer?.ready ? "取消准备" : "准备开汤"}
                </button>
                <div className="share-link">{shareUrl}</div>
              </div>
            </section>

            <div className="room-layout">
              <aside className="room-column room-column-left">
                <section className="glass-card dossier-card">
                  <div className="section-label">案件板</div>
                  <h3>汤面档案</h3>
                  <p>{session.soup.opening}</p>
                  <div className="tag-row">
                    {(session.soup.tags ?? []).map((tag) => (
                      <span key={tag} className="soft-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="progress-block">
                    <div className="progress-head">
                      <span>团队进度</span>
                      <strong>{latestProgress}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${latestProgress}%` }} />
                    </div>
                  </div>
                  {session.phase === "solved" && session.solutionSummary && (
                    <div className="solution-panel">
                      <div className="solution-title">真相回放</div>
                      <p>{session.solutionSummary}</p>
                    </div>
                  )}
                </section>

                <section className="glass-card pulse-card">
                  <div className="section-label">局势概览</div>
                  <div className="stats-grid">
                    <div className="stat-box">
                      <span>在线侦探</span>
                      <strong>{session.metrics.onlinePlayers}</strong>
                    </div>
                    <div className="stat-box">
                      <span>已准备</span>
                      <strong>{session.metrics.readyPlayers}</strong>
                    </div>
                    <div className="stat-box">
                      <span>问题数</span>
                      <strong>{session.metrics.questions}</strong>
                    </div>
                    <div className="stat-box">
                      <span>理论数</span>
                      <strong>{session.metrics.theories}</strong>
                    </div>
                  </div>
                </section>
              </aside>

              <section className="glass-card transcript-panel">
                <div className="transcript-header">
                  <div>
                    <div className="section-label">现场记录</div>
                    <h3>多人推理实况</h3>
                  </div>
                  <div className="quick-action-row">
                    <button
                      type="button"
                      className="chip-button"
                      disabled={asking}
                      onClick={() => handleAsk("hint", "给我们一个不剧透但有方向的提示")}
                    >
                      请求提示
                    </button>
                    <button
                      type="button"
                      className="chip-button"
                      disabled={asking}
                      onClick={() => handleAsk("progress", "进度")}
                    >
                      查看进度
                    </button>
                    <button
                      type="button"
                      className="chip-button"
                      disabled={asking}
                      onClick={() => {
                        setComposerMode("theory");
                        setInput((current) => current || "我的推理是：");
                      }}
                    >
                      提交理论
                    </button>
                  </div>
                </div>

                <div
                  className="transcript-stream"
                  ref={transcriptRef}
                  onScroll={handleTranscriptScroll}
                >
                  {session.history.map((turn) => (
                    <TranscriptRow
                      key={turn.id}
                      turn={turn}
                      isSelf={turn.playerId === player.id}
                    />
                  ))}
                  <div ref={transcriptEndRef} />
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="unread-badge"
                    onClick={() => {
                      setIsAtBottom(true);
                      setUnreadCount(0);
                      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                    }}
                  >
                    有 {unreadCount} 条新消息，点我跳到底部
                  </button>
                )}

                <div className="composer-card">
                  <div className="composer-switch">
                    <button
                      type="button"
                      className={composerMode === "question" ? "switch-pill active" : "switch-pill"}
                      onClick={() => setComposerMode("question")}
                    >
                      普通提问
                    </button>
                    <button
                      type="button"
                      className={composerMode === "theory" ? "switch-pill active" : "switch-pill"}
                      onClick={() => setComposerMode("theory")}
                    >
                      提交理论
                    </button>
                  </div>
                  <textarea
                    className="composer-input"
                    value={input}
                    rows={3}
                    placeholder={
                      composerMode === "theory"
                        ? "把你的完整推理写给主持人，例如：我的推理是……"
                        : "试着问一个能缩小真相范围的问题，例如：这和人物关系有关吗？"
                    }
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (canSend) {
                          void handleAsk(composerMode);
                        }
                      }
                    }}
                    disabled={asking}
                  />
                  <div className="composer-footer">
                    <div className="composer-hint">
                      {session.phase === "solved"
                        ? "本局已揭晓，仍然可以继续复盘交流。"
                        : "Enter 发送，Shift + Enter 换行。多人局里提交理论会被记录成团队事件。"}
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!canSend}
                      onClick={() => handleAsk(composerMode)}
                    >
                      {asking ? "主持人判断中..." : composerMode === "theory" ? "提交理论" : "发起提问"}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="room-column room-column-right">
                <section className="glass-card roster-card">
                  <div className="section-label">房内成员</div>
                  <h3>侦探名单</h3>
                  <div className="roster-list">
                    {session.players.map((member) => (
                      <PlayerRow key={member.id} player={member} isSelf={member.id === player.id} />
                    ))}
                  </div>
                </section>

                <section className="glass-card event-card">
                  <div className="section-label">房间脉搏</div>
                  <h3>实时事件流</h3>
                  <div className="event-list">
                    {roomEvents.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : (
          <div className="lobby-layout">
            <section className="glass-card lobby-feature">
              <div className="section-label">开局设置</div>
              <h2>先挑一锅汤，再把朋友叫进来</h2>
              <p>
                新版房间会显示玩家在线状态、准备状态、事件流和团队进度。你可以先选题，再创建真正的多人推理房。
              </p>
              {selectedSoup && (
                <div className="selected-soup-card">
                  <div className="selected-soup-top">
                    <div>
                      <div className="mini-label">当前选题</div>
                      <h3>{selectedSoup.title}</h3>
                    </div>
                    <div className="difficulty-pill">{difficultyLabel(selectedSoup.difficulty)}</div>
                  </div>
                  <p>{selectedSoup.opening}</p>
                  <div className="tag-row">
                    {(selectedSoup.tags ?? []).map((tag) => (
                      <span key={tag} className="soft-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="lobby-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCreateSession}
                  disabled={!selectedSoup || creating}
                >
                  {creating ? "房间生成中..." : "创建多人房"}
                </button>
                <div className="lobby-note">
                  房间创建后会立即把你作为房主加入房间，并生成可分享的邀请链接。
                </div>
              </div>
            </section>

            <section className="glass-card catalog-card">
              <div className="catalog-head">
                <div>
                  <div className="section-label">题库</div>
                  <h2>挑一个适合今晚气氛的汤面</h2>
                </div>
                <div className="catalog-meta">{soups.length} 个可玩题目</div>
              </div>

              <div className="catalog-grid">
                {soups.map((soup) => (
                  <button
                    key={soup.id}
                    type="button"
                    className={soup.id === selectedSoupId ? "soup-card selected" : "soup-card"}
                    onClick={() => setSelectedSoupId(soup.id)}
                  >
                    <div className="soup-card-top">
                      <strong>{soup.title}</strong>
                      <span>{difficultyLabel(soup.difficulty)}</span>
                    </div>
                    <p>{soup.opening}</p>
                    <div className="tag-row">
                      {(soup.tags ?? []).map((tag) => (
                        <span key={tag} className="soft-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {error && <div className="floating-error">{error}</div>}
      <footer className="app-footer">状态：{status === "loading" ? "加载中" : status === "error" ? "异常" : "已就绪"} · 最近同步 {formatTimeLabel(session?.lastUpdated)}</footer>
    </div>
  );
};

function TranscriptRow({ turn, isSelf }: { turn: ChatTurn; isSelf: boolean }) {
  const label = verdictLabel(turn);
  const isHost = turn.role === "assistant";
  const className =
    turn.role === "system"
      ? "transcript-row system"
      : isHost
      ? "transcript-row host"
      : isSelf
      ? "transcript-row self"
      : "transcript-row player";

  return (
    <article className={className}>
      <div className="bubble-meta">
        <span>{turn.role === "assistant" ? "主持人" : turn.playerName ?? "玩家"}</span>
        <span>{formatTimeLabel(turn.createdAt)}</span>
      </div>
      <div className="bubble-content">
        {label && <span className="verdict-chip">{label}</span>}
        <span>{turn.content}</span>
      </div>
    </article>
  );
}

function PlayerRow({ player, isSelf }: { player: SessionPlayer; isSelf: boolean }) {
  return (
    <div className={player.online ? "player-row online" : "player-row"}>
      <div className="player-avatar">{player.name.slice(0, 1)}</div>
      <div className="player-main">
        <div className="player-name-line">
          <strong>{player.name}</strong>
          {player.isHost && <span className="tiny-pill">房主</span>}
          {isSelf && <span className="tiny-pill muted">你</span>}
        </div>
        <div className="player-meta">
          <span>{player.statusLabel}</span>
          <span>{player.questionsAsked} 问</span>
          <span>{player.theoriesSubmitted} 理论</span>
          <span>{player.score} 分</span>
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: SessionEvent }) {
  return (
    <div className="event-row">
      <div className="event-dot" />
      <div>
        <div className="event-message">{event.message}</div>
        <div className="event-time">{formatTimeLabel(event.createdAt)}</div>
      </div>
    </div>
  );
}

export default App;

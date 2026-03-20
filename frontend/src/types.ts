export interface TurtleSoupSummary {
  id: string;
  title: string;
  opening: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}

export interface TurtleSoupDetail extends TurtleSoupSummary {
  truth?: string;
}

export interface PlayerIdentity {
  id: string;
  name: string;
}

export type ChatRole = "user" | "assistant" | "system";
export type ChatKind =
  | "question"
  | "theory"
  | "hint"
  | "progress"
  | "host_reply"
  | "system"
  | "celebration";
export type SessionPhase = "lobby" | "playing" | "solved";
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

export interface ChatTurn {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  kind: ChatKind;
  playerId?: string;
  playerName?: string;
  verdict?: string;
  progress?: number;
}

export interface SessionPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  online: boolean;
  joinedAt: string;
  lastSeenAt: string;
  questionsAsked: number;
  theoriesSubmitted: number;
  score: number;
  statusLabel: string;
}

export interface SessionEvent {
  id: string;
  kind: SessionEventKind;
  message: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
}

export interface SessionInfo {
  sessionId: string;
  phase: SessionPhase;
  soup: TurtleSoupDetail;
  players: SessionPlayer[];
  history: ChatTurn[];
  events: SessionEvent[];
  lastUpdated?: string;
  createdAt?: string;
  solvedAt?: string;
  solutionSummary?: string;
  metrics: {
    onlinePlayers: number;
    readyPlayers: number;
    questions: number;
    theories: number;
  };
}

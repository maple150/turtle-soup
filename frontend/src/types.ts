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

export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  role: ChatRole;
  content: string;
  timestamp?: string;
}

export interface SessionInfo {
  sessionId: string;
  soup: TurtleSoupDetail;
  history: ChatTurn[];
  lastUpdated?: string;
  createdAt?: string;
}



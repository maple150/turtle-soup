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

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}


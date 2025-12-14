
export interface ChatMessage {
  id: string;
  timestamp: number;
  sender: 'user' | 'expert';
  text: string;
  readByUser: boolean;
  readByExpert: boolean;
}

export interface ChatSession {
  id: string; // Corresponds to the username
  username: string;
  messages: ChatMessage[];
  lastMessageTimestamp: number;
  hasUnreadByExpert: boolean;
}

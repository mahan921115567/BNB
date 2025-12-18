
export interface ChatMessage {
  id: string;
  timestamp: number;
  sender: 'user' | 'expert';
  text: string;
  readByUser: boolean;
  readByExpert: boolean;
}

export interface ChatSession {
  id: string; // Corresponds to the username or guestId
  username: string;
  isGuest: boolean;
  messages: ChatMessage[];
  lastMessageTimestamp: number;
  hasUnreadByExpert: boolean;
}
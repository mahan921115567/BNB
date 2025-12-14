
import { Injectable, signal, computed } from '@angular/core';
import { ChatMessage, ChatSession } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly STORAGE_KEY = 'crypto_chat_sessions';

  private chatSessions = signal<ChatSession[]>([]);

  constructor() {
    this.loadSessions();
  }

  private loadSessions() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.chatSessions.set(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error('Failed to load chat sessions', e);
      this.chatSessions.set([]);
    }
  }

  private saveSessions() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.chatSessions()));
  }

  // For expert panel: list all chats
  getExpertChatList() {
    return computed(() => 
      this.chatSessions().sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp)
    );
  }

  // For both user and expert: get a specific chat session
  getSession(username: string) {
    return computed(() => this.chatSessions().find(s => s.username === username));
  }

  // Send a message
  sendMessage(username: string, text: string, sender: 'user' | 'expert') {
    if (!text.trim()) return;

    this.chatSessions.update(sessions => {
      let session = sessions.find(s => s.username === username);
      const newMessage: ChatMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sender,
        text,
        readByUser: sender === 'user',
        readByExpert: sender === 'expert',
      };

      if (session) {
        session.messages.push(newMessage);
        session.lastMessageTimestamp = newMessage.timestamp;
        session.hasUnreadByExpert = sender === 'user';
      } else {
        session = {
          id: username,
          username,
          messages: [newMessage],
          lastMessageTimestamp: newMessage.timestamp,
          hasUnreadByExpert: sender === 'user',
        };
        sessions.push(session);
      }
      return [...sessions];
    });
    this.saveSessions();
  }

  // Mark messages as read
  markAsRead(username: string, reader: 'user' | 'expert') {
     this.chatSessions.update(sessions => {
        const session = sessions.find(s => s.username === username);
        if (session) {
            if(reader === 'expert') {
                session.hasUnreadByExpert = false;
            }
            session.messages.forEach(msg => {
                if (reader === 'user' && msg.sender === 'expert') msg.readByUser = true;
                if (reader === 'expert' && msg.sender === 'user') msg.readByExpert = true;
            });
        }
        return [...sessions];
     });
     this.saveSessions();
  }

  // For user notification dot
  getUnreadUserCount(username: string | undefined) {
    if (!username) return computed(() => 0);
    return computed(() => {
        const session = this.chatSessions().find(s => s.username === username);
        if (!session) return 0;
        return session.messages.filter(m => m.sender === 'expert' && !m.readByUser).length;
    });
  }
}

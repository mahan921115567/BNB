import { Injectable, signal, computed } from '@angular/core';
import { ChatMessage, ChatSession } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly STORAGE_KEY = 'crypto_chat_sessions';

  public chatSessions = signal<ChatSession[]>([]);

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

  // Send a message
  sendMessage(sessionId: string, text: string, sender: 'user' | 'expert', isGuest: boolean) {
    if (!text.trim()) return;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sender,
      text,
      readByUser: sender === 'user',
      readByExpert: sender === 'expert',
    };

    this.chatSessions.update(sessions => {
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);

      if (sessionIndex > -1) {
        // Update existing session immutably
        const existingSession = sessions[sessionIndex];
        const updatedSession: ChatSession = {
          ...existingSession,
          messages: [...existingSession.messages, newMessage],
          lastMessageTimestamp: newMessage.timestamp,
          hasUnreadByExpert: sender === 'user' ? true : existingSession.hasUnreadByExpert,
        };
        // Return a new array with the updated session
        return sessions.map((s, index) => index === sessionIndex ? updatedSession : s);
      } else {
        // Create a new session
        const newSession: ChatSession = {
          id: sessionId,
          username: sessionId,
          isGuest: isGuest,
          messages: [newMessage],
          lastMessageTimestamp: newMessage.timestamp,
          hasUnreadByExpert: sender === 'user',
        };
        // Return a new array with the new session added
        return [...sessions, newSession];
      }
    });
    this.saveSessions();
  }

  // Mark messages as read
  markAsRead(sessionId: string, reader: 'user' | 'expert') {
    this.chatSessions.update(sessions =>
      sessions.map(session => {
        if (session.id !== sessionId) {
          return session;
        }

        // Create a new session object for the one being updated
        return {
          ...session,
          hasUnreadByExpert: reader === 'expert' ? false : session.hasUnreadByExpert,
          messages: session.messages.map(msg => {
            const needsUserReadUpdate = reader === 'user' && msg.sender === 'expert' && !msg.readByUser;
            const needsExpertReadUpdate = reader === 'expert' && msg.sender === 'user' && !msg.readByExpert;

            if (needsUserReadUpdate) {
              return { ...msg, readByUser: true };
            }
            if (needsExpertReadUpdate) {
              return { ...msg, readByExpert: true };
            }
            return msg;
          }),
        };
      })
    );
    this.saveSessions();
  }
}
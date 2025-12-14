
import { Injectable, signal, computed } from '@angular/core';
import { AppNotification } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly STORAGE_KEY = 'crypto_notifications';
  
  // Holds all notifications in the system
  private allNotifications = signal<AppNotification[]>([]);

  constructor() {
    this.loadNotifications();
  }

  private loadNotifications() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.allNotifications.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  }

  private saveNotifications() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.allNotifications()));
  }

  // Add a notification for a specific user or everyone ('all')
  addNotification(userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const newNote: AppNotification = {
      id: crypto.randomUUID(),
      userId,
      title,
      message,
      type,
      timestamp: Date.now(),
      read: false
    };

    this.allNotifications.update(notes => [newNote, ...notes]);
    this.saveNotifications();
  }

  // Get notifications filtered for a specific user
  getUserNotifications(username: string) {
    return computed(() => {
      return this.allNotifications()
        .filter(n => n.userId === username || n.userId === 'all')
        .sort((a, b) => b.timestamp - a.timestamp);
    });
  }
  
  // Count unread for a user
  getUnreadCount(username: string) {
    return computed(() => {
        return this.allNotifications().filter(n => (n.userId === username || n.userId === 'all') && !n.read).length;
    });
  }

  markAsRead(notificationId: string) {
    this.allNotifications.update(notes => 
      notes.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    this.saveNotifications();
  }

  markAllAsRead(username: string) {
    this.allNotifications.update(notes => 
      notes.map(n => (n.userId === username || n.userId === 'all') ? { ...n, read: true } : n)
    );
    this.saveNotifications();
  }
}

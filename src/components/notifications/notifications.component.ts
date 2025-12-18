import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class NotificationsComponent {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  isOpen = signal(false);
  
  currentUser = this.authService.currentUser;

  userNotifications = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    const username = user.username;
    return this.notificationService.allNotifications()
      .filter(n => n.userId === username || n.userId === 'all')
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  unreadCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    const username = user.username;
    return this.notificationService.allNotifications().filter(n => (n.userId === username || n.userId === 'all') && !n.read).length;
  });

  toggle() {
    this.isOpen.update(v => !v);
  }

  markAsRead(id: string) {
    this.notificationService.markAsRead(id);
  }

  markAllRead() {
     const user = this.currentUser();
     if(user) this.notificationService.markAllAsRead(user.username);
  }
}
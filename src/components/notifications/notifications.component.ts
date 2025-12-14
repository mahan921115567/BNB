
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
    return this.notificationService.getUserNotifications(user.username)();
  });

  unreadCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    return this.notificationService.getUnreadCount(user.username)();
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

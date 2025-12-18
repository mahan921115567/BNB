
import { Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { GuestSessionService } from '../../services/guest-session.service';

@Component({
  selector: 'app-floating-support-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './floating-support-chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingSupportChatComponent {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private guestSessionService = inject(GuestSessionService);

  @ViewChild('chatMessagesContainer') private chatMessagesContainer!: ElementRef<HTMLDivElement>;

  isOpen = signal(false);
  newMessage = ''; // Changed from signal to primitive to fix ngModel crash

  currentUser = this.authService.currentUser;

  isGuest = computed(() => this.currentUser() === null);
  sessionId = computed(() => this.isGuest() ? this.guestSessionService.getGuestId() : this.currentUser()!.username);
  
  session = computed(() => this.chatService.chatSessions().find(s => s.id === this.sessionId()));
  messages = computed(() => this.session()?.messages || []);
  
  unreadCount = computed(() => {
    const s = this.session();
    if (!s) return 0;
    return s.messages.filter(m => m.sender === 'expert' && !m.readByUser).length;
  });

  constructor() {
    effect(() => {
      // When new messages arrive, scroll to bottom
      if (this.messages() && this.isOpen() && this.chatMessagesContainer) {
        setTimeout(() => this.scrollToBottom(), 0);
      }
    });
  }

  toggleChat() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      // Mark as read when opening
      this.chatService.markAsRead(this.sessionId(), 'user');
    }
  }

  sendMessage() {
    if (this.newMessage.trim()) {
      this.chatService.sendMessage(this.sessionId(), this.newMessage, 'user', this.isGuest());
      this.newMessage = '';
    }
  }

  private scrollToBottom(): void {
    try {
      this.chatMessagesContainer.nativeElement.scrollTop = this.chatMessagesContainer.nativeElement.scrollHeight;
    } catch(err) { /* Fails silently if element not ready */ }
  }
}

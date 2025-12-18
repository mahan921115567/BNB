
import { Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-support',
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportComponent {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLDivElement>;

  currentUser = this.authService.currentUser;
  newMessage = ''; // Changed from signal to primitive
  
  username = computed(() => this.currentUser()?.username || '');

  session = computed(() => this.chatService.chatSessions().find(s => s.id === this.username()));
  
  messages = computed(() => this.session()?.messages || []);

  constructor() {
    effect(() => {
      // When messages change, scroll to bottom
      if (this.messages() && this.chatContainer) {
        setTimeout(() => this.scrollToBottom(), 0);
      }
    });

    // Mark messages as read when the component is viewed and the user is identified.
    effect(() => {
      const user = this.username();
      if (user) {
        this.chatService.markAsRead(user, 'user');
      }
    });
  }

  sendMessage() {
    if (this.newMessage.trim() && this.username()) {
      this.chatService.sendMessage(this.username(), this.newMessage, 'user', false);
      this.newMessage = '';
    }
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }
}

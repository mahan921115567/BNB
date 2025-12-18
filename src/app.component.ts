import { Component, signal, ChangeDetectionStrategy, inject, computed, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TradeComponent } from './components/trade/trade.component';
import { WalletComponent } from './components/wallet/wallet.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthService } from './services/auth.service';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { PriceListComponent } from './components/prices/price-list.component';
import { ExpertPanelComponent } from './components/expert/expert-panel.component';
import { LandingComponent } from './components/landing/landing.component';
import { HistoryComponent } from './components/history/history.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { SupportComponent } from './components/support/support.component';
import { ChatService } from './services/chat.service';
import { FloatingSupportChatComponent } from './components/floating-support-chat/floating-support-chat.component';
import { InactivityService } from './services/inactivity.service';

type View = 'prices' | 'buy' | 'sell' | 'wallet' | 'history' | 'support';
type AuthView = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TradeComponent, WalletComponent, LoginComponent, RegisterComponent, WelcomeComponent, PriceListComponent, ExpertPanelComponent, LandingComponent, HistoryComponent, NotificationsComponent, ForgotPasswordComponent, SupportComponent, FloatingSupportChatComponent],
})
export class AppComponent implements OnDestroy {
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private inactivityService = inject(InactivityService);
  private inactivitySubscription: Subscription;
  private notificationSound = new Audio('data:audio/mpeg;base64,SUQzBAAAAAAAI7AAR1NTRgAAAAAAAAAAAABhTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFD//');
  private previousUnreadCount: number = 0;

  currentView = signal<View>('prices');
  authView = signal<AuthView>('login');
  showLanding = signal<boolean>(true); // Show landing by default
  logoutMessage = signal<string | null>(null);
  
  currentUser = this.authService.currentUser;
  isNewUser = this.authService.isNewUser;
  isExpert = this.authService.isExpert;

  unreadSupportMessages = computed(() => {
    const username = this.currentUser()?.username;
    if (!username) return 0;
    const session = this.chatService.chatSessions().find(s => s.id === username);
    if (!session) return 0;
    return session.messages.filter(m => m.sender === 'expert' && !m.readByUser).length;
  });

  constructor() {
    this.authService.checkSession();
    
    // Initialize previousUnreadCount with the initial value to prevent sound on load
    this.previousUnreadCount = this.unreadSupportMessages();

    // Effect to play sound on new message
    effect(() => {
      const newUnreadCount = this.unreadSupportMessages();
      if (newUnreadCount > this.previousUnreadCount) {
        // Play sound only if the window/tab is active to avoid being annoying
        if (document.hasFocus()) {
          this.notificationSound.play().catch(e => console.warn("Audio playback failed.", e));
        }
      }
      this.previousUnreadCount = newUnreadCount;
    });
    
    // If user is already logged in, skip landing
    if (this.currentUser()) {
        this.showLanding.set(false);
    }
    
    effect(() => {
      if (this.currentUser() && !this.isExpert()) {
        this.inactivityService.startWatching();
      } else {
        this.inactivityService.stopWatching();
      }
    });

    this.inactivitySubscription = this.inactivityService.onTimeout.subscribe(() => {
      if (this.currentUser() && !this.isExpert()) {
        this.logoutMessage.set('شما به دلیل عدم فعالیت به مدت ۵ دقیقه، از حساب خود خارج شدید.');
        this.logout();
        setTimeout(() => this.logoutMessage.set(null), 7000);
      }
    });
  }
  
  ngOnDestroy(): void {
    this.inactivitySubscription.unsubscribe();
    this.inactivityService.stopWatching();
  }

  enterApp() {
    this.showLanding.set(false);
  }

  setView(view: View) {
    this.currentView.set(view);
  }

  setAuthView(view: AuthView) {
    this.authView.set(view);
    this.logoutMessage.set(null);
  }

  logout() {
    this.authService.logout();
    this.currentView.set('prices'); 
    this.showLanding.set(true); // Return to landing on logout
  }

  dismissWelcome() {
    this.authService.dismissNewUserWelcome();
  }
}
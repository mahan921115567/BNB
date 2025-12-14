
import { Component, signal, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ThemeService } from './services/theme.service';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { SupportComponent } from './components/support/support.component';
import { ChatService } from './services/chat.service';

type View = 'prices' | 'buy' | 'sell' | 'wallet' | 'history' | 'support';
type AuthView = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TradeComponent, WalletComponent, LoginComponent, RegisterComponent, WelcomeComponent, PriceListComponent, ExpertPanelComponent, LandingComponent, HistoryComponent, NotificationsComponent, ForgotPasswordComponent, SupportComponent],
})
export class AppComponent {
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  themeService = inject(ThemeService); // Made public for template access
  
  currentView = signal<View>('prices');
  authView = signal<AuthView>('login');
  showLanding = signal<boolean>(true); // Show landing by default
  
  currentUser = this.authService.currentUser;
  isNewUser = this.authService.isNewUser;
  isExpert = this.authService.isExpert;

  unreadSupportMessages = computed(() => {
    return this.chatService.getUnreadUserCount(this.currentUser()?.username)();
  });

  constructor() {
    this.authService.checkSession();
    // If user is already logged in, skip landing
    if (this.currentUser()) {
        this.showLanding.set(false);
    }
  }

  enterApp() {
    this.showLanding.set(false);
  }

  setView(view: View) {
    this.currentView.set(view);
  }

  setAuthView(view: AuthView) {
    this.authView.set(view);
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

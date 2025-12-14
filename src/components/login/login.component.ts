
import { Component, ChangeDetectionStrategy, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CaptchaComponent } from '../captcha/captcha.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CaptchaComponent],
})
export class LoginComponent {
  private authService = inject(AuthService);
  forgotPassword = output<void>();

  // Form State
  username = signal('');
  password = signal('');
  otpCode = signal('');
  
  // Logic State
  loginStep = signal<'credentials' | '2fa'>('credentials');
  isCaptchaVerified = signal(false);
  
  // Feedback
  status = signal<{ success: boolean; message: string } | null>(null);
  mockSmsNotification = signal<string | null>(null);

  onCaptchaVerify(verified: boolean) {
    this.isCaptchaVerified.set(verified);
  }

  handleLoginStep1() {
    if (!this.username() || !this.password()) {
      this.status.set({ success: false, message: 'نام کاربری و رمز عبور الزامی است.' });
      return;
    }
    
    if (!this.isCaptchaVerified()) {
        this.status.set({ success: false, message: 'لطفاً کپچا را حل کنید.' });
        return;
    }

    const result = this.authService.validateCredentials({
      username: this.username(),
      password: this.password()
    });

    if (result.status === 'fail') {
      this.status.set({ success: false, message: result.message });
    } else if (result.status === '2fa_required') {
      // Move to next step
      this.loginStep.set('2fa');
      this.status.set(null);
      
      // Simulate sending SMS
      const code = this.authService.generateTwoFactorCode();
      this.showMockSms(code);
    } 
    // If 'success' returned immediately (no 2FA), App component handles view switch automatically via reactive currentUser
  }

  handleVerifyOtp() {
    if (!this.otpCode() || this.otpCode().length !== 6) {
      this.status.set({ success: false, message: 'کد تایید باید ۶ رقم باشد.' });
      return;
    }

    const result = this.authService.verifyTwoFactor(this.otpCode());
    
    if (!result.success) {
      this.status.set(result);
    }
    // On success, AuthService sets currentUser, triggering AppComponent view switch
  }

  private showMockSms(code: string) {
    // Simulate a notification appearing on the user's "Phone"
    setTimeout(() => {
      this.mockSmsNotification.set(`پیامک جدید: کد تایید ورود شما ${code} است.`);
      
      // Hide after 10 seconds
      setTimeout(() => this.mockSmsNotification.set(null), 10000);
    }, 1000);
  }
}

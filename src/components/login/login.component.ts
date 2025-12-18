
import { Component, ChangeDetectionStrategy, signal, inject, output, OnDestroy } from '@angular/core';
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
export class LoginComponent implements OnDestroy {
  private authService = inject(AuthService);
  forgotPassword = output<void>();

  // Form State (Changed from Signals to Primitives to fix ngModel crash)
  username = '';
  password = '';
  otpCode = '';
  gaCode = '';
  
  // Logic State
  loginStep = signal<'credentials' | '2fa' | 'ga' | 'ga-setup'>('credentials');
  isCaptchaVerified = signal(false);
  otpTimer = signal(0);
  canResendOtp = signal(false);
  private otpTimerInterval: any;
  
  // Feedback
  status = signal<{ success: boolean; message: string } | null>(null);
  mockSmsNotification = signal<{ text: string; code: string } | null>(null);
  
  // GA Setup State
  tempGaSecret = signal<{secret: string, qrUrl: string} | null>(null);
  gaSetupState = signal<'generating' | 'ready' | 'error'>('generating');
  gaGenerationTimer = signal(3);
  private gaTimerInterval: any;
  gaVerificationCode = ''; // Primitive
  isGaCodeVerified = signal(false);
  gaVerificationError = signal<string | null>(null);
  showCopyFeedback = signal(false);


  ngOnDestroy() {
    this.stopOtpTimer();
    this.stopGaTimer();
  }

  onCaptchaVerify(verified: boolean) {
    this.isCaptchaVerified.set(verified);
  }

  async handleLoginStep1() {
    if (!this.username || !this.password) {
      this.status.set({ success: false, message: 'نام کاربری و رمز عبور الزامی است.' });
      return;
    }
    
    if (!this.isCaptchaVerified()) {
        this.status.set({ success: false, message: 'لطفاً کپچا را حل کنید.' });
        return;
    }

    const result = await this.authService.validateCredentials({
      username: this.username,
      password: this.password
    });

    if (result.status === 'fail' || result.status === 'locked') {
      this.status.set({ success: false, message: result.message });
    } else if (result.status === '2fa_required') {
      // Move to next step
      this.loginStep.set('2fa');
      this.status.set(null);
      
      // Simulate sending SMS
      const code = this.authService.generateTwoFactorCode();
      this.showMockSms(code);
      this.startOtpTimer();
    } 
    // If 'success' returned immediately (no 2FA), App component handles view switch automatically via reactive currentUser
  }

  handleVerifyOtp() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.status.set({ success: false, message: 'کد تایید باید ۶ رقم باشد.' });
      return;
    }

    const result = this.authService.verifyTwoFactor(this.otpCode);
    
    if (result.success) {
      this.stopOtpTimer();
      if (result.gaSetupRequired) {
        this.loginStep.set('ga-setup');
        this.initializeGaSecret();
        this.status.set(null);
      } else if (result.gaRequired) {
        this.loginStep.set('ga');
        this.status.set(null);
      }
      // On regular user success without GA, AuthService sets currentUser, triggering AppComponent view switch
    } else {
      this.status.set(result);
    }
  }

  async handleVerifyGa() {
    if (!this.gaCode || this.gaCode.length !== 6) {
      this.status.set({ success: false, message: 'کد تایید گوگل باید ۶ رقم باشد.' });
      return;
    }
    const result = await this.authService.verifyGoogleAuthenticator(this.gaCode);
    if (!result.success) {
      this.status.set(result);
    }
    // on success, authService finalizes login
  }

  private showMockSms(code: string) {
    // Simulate a notification appearing on the user's "Phone"
    setTimeout(() => {
      this.mockSmsNotification.set({ text: 'کد تایید ورود شما:', code: code });
      
      // Hide after 10 seconds
      setTimeout(() => this.mockSmsNotification.set(null), 10000);
    }, 1000);
  }

  private startOtpTimer() {
    this.stopOtpTimer(); // Clear any existing timer
    this.canResendOtp.set(false);
    this.otpTimer.set(60);
    this.otpTimerInterval = setInterval(() => {
      this.otpTimer.update(t => t - 1);
      if (this.otpTimer() <= 0) {
        this.stopOtpTimer();
        this.canResendOtp.set(true);
      }
    }, 1000);
  }

  private stopOtpTimer() {
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
      this.otpTimerInterval = null;
    }
  }

  resendOtp() {
    if (!this.canResendOtp()) return;
    const code = this.authService.generateTwoFactorCode();
    this.showMockSms(code);
    this.startOtpTimer();
  }

  goBackToCredentials() {
    this.stopOtpTimer();
    this.stopGaTimer();
    this.status.set(null);
    this.loginStep.set('credentials');
    this.otpCode = '';
    this.gaCode = '';
  }
  
  // --- GA Setup Methods ---

  private initializeGaSecret() {
    this.isGaCodeVerified.set(false);
    this.gaVerificationCode = '';
    this.gaVerificationError.set(null);

    const secret = this.authService.generateGoogleAuthenticatorSecret();
    const issuer = 'NEVEX';
    const qrUrl = `otpauth://totp/${issuer}:${this.username}?secret=${secret}&issuer=${issuer}`;
    this.tempGaSecret.set({ secret, qrUrl });
    this.startGaCodeGeneration();
  }

  private startGaCodeGeneration() {
    this.gaSetupState.set('generating');
    this.gaGenerationTimer.set(3);
    this.stopGaTimer();

    this.gaTimerInterval = setInterval(() => {
        this.gaGenerationTimer.update(t => Math.max(0, t - 1));
    }, 1000);

    setTimeout(() => {
        this.stopGaTimer();
        this.gaSetupState.set('ready');
    }, 3000);
  }
  
  private stopGaTimer() {
      if(this.gaTimerInterval) {
          clearInterval(this.gaTimerInterval);
          this.gaTimerInterval = null;
      }
  }

  async verifyGaCodeForSetup() {
    this.gaVerificationError.set(null);
    const secret = this.tempGaSecret()?.secret;
    const code = this.gaVerificationCode;

    if (!secret || !code || code.length !== 6) {
      this.gaVerificationError.set('کد باید ۶ رقمی باشد.');
      return;
    }

    const isValid = await this.authService.verifyTempGoogleAuthenticatorCode(secret, code);
    
    if (isValid) {
      this.isGaCodeVerified.set(true);
      this.gaVerificationError.set(null);
    } else {
      this.isGaCodeVerified.set(false);
      this.gaVerificationError.set('کد وارد شده صحیح نیست. لطفا دوباره تلاش کنید.');
    }
  }

  completeGaSetup() {
    this.status.set(null);
    if (!this.isGaCodeVerified()) {
        this.status.set({ success: false, message: 'لطفا ابتدا کد تایید دو مرحله‌ای گوگل را تایید کنید.'});
        return;
    }

    const secret = this.tempGaSecret()?.secret;
    if (!secret) {
        this.status.set({ success: false, message: 'خطا در ایجاد کد امنیتی. لطفا دوباره تلاش کنید.'});
        return;
    }

    const gaResult = this.authService.enableGoogleAuthenticator(this.username, secret);
    if (!gaResult.success) {
        this.status.set(gaResult);
        return;
    }

    // Now finalize login
    const loginFinalized = this.authService.finalizePendingLogin();
    if (!loginFinalized) {
        this.status.set({ success: false, message: 'خطا در نهایی‌سازی نشست ورود.' });
    }
    // On success, app component handles the view change.
  }
  
  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.showCopyFeedback.set(true);
      setTimeout(() => this.showCopyFeedback.set(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }
}
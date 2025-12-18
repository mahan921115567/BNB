
import { Component, ChangeDetectionStrategy, signal, inject, output, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CaptchaComponent } from '../captcha/captcha.component';
import { PasswordStrengthComponent } from '../password-strength/password-strength.component';
import { UsernameRulesComponent } from '../username-rules/username-rules.component';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CaptchaComponent, PasswordStrengthComponent, UsernameRulesComponent],
})
export class RegisterComponent implements OnDestroy {
  private authService = inject(AuthService);
  registerSuccess = output<void>();

  // Form State (Primitives)
  registerStep = signal<'phone' | 'otp' | 'details'>('phone');
  
  // Step 1
  phone = '';
  
  // Step 2
  otpCode = '';
  
  // Step 3
  username = '';
  password = '';
  nationalId = '';
  birthDate = '';
  birthPlace = '';
  email = '';
  isCaptchaVerified = signal(false);

  // Feedback
  status = signal<{ success: boolean; message: string } | null>(null);
  mockSmsNotification = signal<{ text: string; code: string } | null>(null);
  otpTimer = signal(0);
  canResendOtp = signal(false);
  private otpTimerInterval: any;

  isPhoneValid() {
    return /^09\d{9}$/.test(this.phone);
  }

  ngOnDestroy() {
    this.stopOtpTimer();
  }

  onCaptchaVerify(verified: boolean) {
    this.isCaptchaVerified.set(verified);
  }

  // Step 1: Send OTP
  handleSendOtp() {
    this.status.set(null);
    const result = this.authService.generateRegistrationOtp(this.phone);

    if (result.success && result.code) {
      this.registerStep.set('otp');
      this.showMockSms(result.code);
      this.startOtpTimer();
    } else {
      this.status.set({ success: false, message: result.message });
    }
  }

  // Step 2: Verify OTP
  handleVerifyOtp() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.status.set({ success: false, message: 'کد تایید باید ۶ رقم باشد.' });
      return;
    }
    
    const isVerified = this.authService.verifyRegistrationOtp(this.phone, this.otpCode);

    if (isVerified) {
      this.status.set(null);
      this.registerStep.set('details');
      this.stopOtpTimer();
    } else {
      this.status.set({ success: false, message: 'کد وارد شده صحیح نیست.' });
    }
  }

  // Step 3: Final Registration
  async handleFinalRegister() {
    this.status.set(null);

    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,19}$/;
    if (!usernameRegex.test(this.username)) {
      this.status.set({ success: false, message: 'نام کاربری شما با قوانین مطابقت ندارد.' });
      return;
    }

    if (!this.username || !this.password || !this.nationalId || !this.birthDate || !this.birthPlace) {
      this.status.set({ success: false, message: 'لطفاً تمام فیلدهای اجباری را پر کنید.' });
      return;
    }
    
    if (!this.isCaptchaVerified()) {
      this.status.set({ success: false, message: 'لطفاً برای ادامه کپچا را حل کنید.' });
      return;
    }

    const result = await this.authService.register({
      username: this.username,
      password: this.password,
      phone: this.phone, // Phone is already verified
      nationalId: this.nationalId,
      birthDate: this.birthDate,
      birthPlace: this.birthPlace,
      email: this.email || undefined
    });

    this.status.set(result);

    if (result.success) {
      // Delay slightly to let user see success message before switching view
      setTimeout(() => {
        this.registerSuccess.emit();
      }, 1500);
    }
  }

  private showMockSms(code: string) {
    setTimeout(() => {
      this.mockSmsNotification.set({ text: 'کد تایید ثبت نام شما:', code: code });
      setTimeout(() => this.mockSmsNotification.set(null), 10000);
    }, 1000);
  }

  private startOtpTimer() {
    this.stopOtpTimer();
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
    const result = this.authService.generateRegistrationOtp(this.phone);
    if (result.success && result.code) {
        this.showMockSms(result.code);
        this.startOtpTimer();
    } else {
        this.status.set({ success: false, message: result.message });
    }
  }

  goBackToPhoneStep() {
      this.stopOtpTimer();
      this.registerStep.set('phone');
  }
}

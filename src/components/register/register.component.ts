
import { Component, ChangeDetectionStrategy, signal, inject, output } from '@angular/core';
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
export class RegisterComponent {
  private authService = inject(AuthService);
  registerSuccess = output<void>();

  // Form State
  registerStep = signal<'phone' | 'otp' | 'details'>('phone');
  
  // Step 1
  phone = signal('');
  
  // Step 2
  otpCode = signal('');
  
  // Step 3
  username = signal('');
  password = signal('');
  nationalId = signal('');
  birthDate = signal('');
  birthPlace = signal('');
  email = signal('');
  isCaptchaVerified = signal(false);

  // Feedback
  status = signal<{ success: boolean; message: string } | null>(null);
  mockSmsNotification = signal<string | null>(null);

  onCaptchaVerify(verified: boolean) {
    this.isCaptchaVerified.set(verified);
  }

  // Step 1: Send OTP
  handleSendOtp() {
    this.status.set(null);
    const result = this.authService.generateRegistrationOtp(this.phone());

    if (result.success && result.code) {
      this.registerStep.set('otp');
      this.showMockSms(result.code);
    } else {
      this.status.set({ success: false, message: result.message });
    }
  }

  // Step 2: Verify OTP
  handleVerifyOtp() {
    if (!this.otpCode() || this.otpCode().length !== 6) {
      this.status.set({ success: false, message: 'کد تایید باید ۶ رقم باشد.' });
      return;
    }
    
    const isVerified = this.authService.verifyRegistrationOtp(this.phone(), this.otpCode());

    if (isVerified) {
      this.status.set(null);
      this.registerStep.set('details');
    } else {
      this.status.set({ success: false, message: 'کد وارد شده صحیح نیست.' });
    }
  }

  // Step 3: Final Registration
  handleFinalRegister() {
    this.status.set(null);

    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,19}$/;
    if (!usernameRegex.test(this.username())) {
      this.status.set({ success: false, message: 'نام کاربری شما با قوانین مطابقت ندارد.' });
      return;
    }

    if (!this.username() || !this.password() || !this.nationalId() || !this.birthDate() || !this.birthPlace()) {
      this.status.set({ success: false, message: 'لطفاً تمام فیلدهای اجباری را پر کنید.' });
      return;
    }
    
    if (!this.isCaptchaVerified()) {
      this.status.set({ success: false, message: 'لطفاً برای ادامه کپچا را حل کنید.' });
      return;
    }

    const result = this.authService.register({
      username: this.username(),
      password: this.password(),
      phone: this.phone(), // Phone is already verified
      nationalId: this.nationalId(),
      birthDate: this.birthDate(),
      birthPlace: this.birthPlace(),
      email: this.email() || undefined
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
      this.mockSmsNotification.set(`کد تایید ثبت نام شما: ${code}`);
      setTimeout(() => this.mockSmsNotification.set(null), 10000);
    }, 1000);
  }
}

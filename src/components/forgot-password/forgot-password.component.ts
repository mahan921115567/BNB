
import { Component, ChangeDetectionStrategy, signal, inject, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class ForgotPasswordComponent {
  private cryptoService = inject(CryptoService);
  backToLogin = output<void>();

  // Form State (Primitives)
  phone = '';
  nationalId = '';
  birthDate = '';
  birthPlace = '';
  email = '';
  estimatedIrt: number | null = null;
  estimatedUsdt: number | null = null;
  
  // Component State
  submittedSuccessfully = signal(false);

  // Feedback
  status = signal<{ success: boolean; message: string } | null>(null);

  // Computed properties
  expertTelegramId = computed(() => this.cryptoService.exchangeConfig().expertTelegramId);
  telegramLink = computed(() => {
    const id = this.expertTelegramId();
    return id ? `https://t.me/${id}` : '';
  });


  handleSubmit() {
    this.status.set(null);

    if (!this.phone || !this.nationalId || !this.birthDate || !this.birthPlace || !this.email || this.estimatedIrt === null || this.estimatedUsdt === null) {
      this.status.set({ success: false, message: 'لطفاً تمام فیلدهای ستاره‌دار را تکمیل کنید.' });
      return;
    }
    
    const result = this.cryptoService.addRecoveryRequest({
        phone: this.phone,
        nationalId: this.nationalId,
        birthDate: this.birthDate,
        birthPlace: this.birthPlace,
        email: this.email,
        estimatedIrt: this.estimatedIrt ?? 0,
        estimatedUsdt: this.estimatedUsdt ?? 0,
    });

    if (result.success) {
      this.submittedSuccessfully.set(true);
      this.status.set({ success: true, message: 'اطلاعات شما با موفقیت ثبت شد. لطفاً برای تکمیل فرآیند، ویدیوی احراز هویت خود را طبق دستورالعمل به کارشناс ما در تلگرام ارسال کنید.' });
    } else {
      this.status.set(result);
    }
  }
}

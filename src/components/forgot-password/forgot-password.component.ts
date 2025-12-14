
import { Component, ChangeDetectionStrategy, signal, inject, output } from '@angular/core';
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

  // Form State
  phone = signal('');
  nationalId = signal('');
  birthDate = signal('');
  birthPlace = signal('');
  email = signal('');
  estimatedIrt = signal<number | null>(null);
  estimatedUsdt = signal<number | null>(null);

  // Feedback
  status = signal<{ success: boolean; message: string } | null>(null);

  handleSubmit() {
    this.status.set(null);

    if (!this.phone() || !this.nationalId() || !this.birthDate() || !this.birthPlace() || !this.email() || this.estimatedIrt() === null || this.estimatedUsdt() === null) {
      this.status.set({ success: false, message: 'لطفاً تمام فیلدهای ستاره‌دار را تکمیل کنید.' });
      return;
    }
    
    const result = this.cryptoService.addRecoveryRequest({
        phone: this.phone(),
        nationalId: this.nationalId(),
        birthDate: this.birthDate(),
        birthPlace: this.birthPlace(),
        email: this.email(),
        estimatedIrt: this.estimatedIrt() ?? 0,
        estimatedUsdt: this.estimatedUsdt() ?? 0,
    });

    this.status.set(result);
  }
}

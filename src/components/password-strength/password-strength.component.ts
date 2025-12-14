
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-password-strength',
  templateUrl: './password-strength.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class PasswordStrengthComponent {
  password = input<string>('');

  private checks = computed(() => {
    const pwd = this.password();
    const hasLowercase = /[a-z]/.test(pwd);
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[!@#$%^&*]/.test(pwd);
    const hasMinLength = pwd.length >= 8;
    
    const score = [hasLowercase, hasUppercase, hasNumber, hasSymbol, hasMinLength].filter(Boolean).length;
    return { score, hasLowercase, hasUppercase, hasNumber, hasSymbol, hasMinLength };
  });

  strength = computed(() => {
    const pwd = this.password();
    if (pwd.length === 0) {
      return 0; // No password
    }
    const { score, hasMinLength } = this.checks();
    
    if (!hasMinLength) {
        return 1; // Very weak if length is not met
    }

    if (score <= 2) return 1; // Very Weak
    if (score === 3) return 2; // Weak
    if (score === 4) return 3; // Medium
    if (score === 5) return 4; // Strong
    
    return 1; // Default to very weak
  });

  strengthLabel = computed(() => {
    switch (this.strength()) {
      case 1: return 'خیلی ضعیف';
      case 2: return 'ضعیف';
      case 3: return 'متوسط';
      case 4: return 'قوی';
      default: return '';
    }
  });

  strengthColorClass = computed(() => {
    switch (this.strength()) {
      case 1: return 'text-red-500';
      case 2: return 'text-orange-500';
      case 3: return 'text-yellow-500';
      case 4: return 'text-green-500';
      default: return 'text-gray-500';
    }
  });

  barColorClass = computed(() => {
    switch (this.strength()) {
      case 1: return 'bg-red-500';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-yellow-500';
      case 4: return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  });

  requirementChecks = computed(() => {
      const { hasLowercase, hasUppercase, hasNumber, hasSymbol, hasMinLength } = this.checks();
      return [
          { label: 'حداقل ۸ کاراکتر', met: hasMinLength },
          { label: 'حرف کوچک انگلیسی (a-z)', met: hasLowercase },
          { label: 'حرف بزرگ انگلیسی (A-Z)', met: hasUppercase },
          { label: 'عدد (0-9)', met: hasNumber },
          { label: 'نماد خاص (!@#$%)', met: hasSymbol },
      ];
  });
}

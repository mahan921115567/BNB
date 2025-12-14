
import { Component, ChangeDetectionStrategy, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CryptoService } from '../../services/crypto.service';
import { DomSanitizer } from '@angular/platform-browser';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class LandingComponent {
  start = output<void>();
  private cryptoService = inject(CryptoService);
  private sanitizer = inject(DomSanitizer);
  themeService = inject(ThemeService);

  cryptos = this.cryptoService.cryptos;

  topCryptos = computed(() => {
    return this.cryptos().slice(0, 4).map(c => ({
        ...c,
        sanitizedLogo: this.sanitizer.bypassSecurityTrustHtml(c.logo)
    }));
  });

  scrollToPrices() {
    const el = document.getElementById('prices-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

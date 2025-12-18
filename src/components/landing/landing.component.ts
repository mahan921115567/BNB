
import { Component, ChangeDetectionStrategy, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CryptoService } from '../../services/crypto.service';
import { DomSanitizer } from '@angular/platform-browser';
import { PriceChartComponent } from '../prices/price-chart.component';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PriceChartComponent],
})
export class LandingComponent {
  start = output<void>();
  private cryptoService = inject(CryptoService);
  private sanitizer = inject(DomSanitizer);

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
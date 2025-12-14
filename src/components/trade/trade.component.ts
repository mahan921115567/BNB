import { Component, ChangeDetectionStrategy, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';
import { Cryptocurrency } from '../../models/crypto.model';

@Component({
  selector: 'app-trade',
  templateUrl: './trade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class TradeComponent {
  mode = input.required<'buy' | 'sell'>();
  
  private cryptoService = inject(CryptoService);
  
  cryptos = this.cryptoService.cryptos;
  wallet = this.cryptoService.wallet;

  selectedCryptoId = signal<string>('bitcoin');
  
  tradeAmount = signal<number | null>(null);

  transactionStatus = signal<{ success: boolean; message: string } | null>(null);

  selectedCrypto = computed<Cryptocurrency | undefined>(() => {
    return this.cryptos().find(c => c.id === this.selectedCryptoId());
  });

  isBuyMode = computed(() => this.mode() === 'buy');

  availableBalance = computed(() => {
    const wallet = this.wallet();
    if (!wallet) return 0;

    if (this.isBuyMode()) {
      return wallet.irtBalance;
    } else {
      const asset = wallet.assets.find(a => a.cryptoId === this.selectedCryptoId());
      return asset ? asset.amount : 0;
    }
  });

  tradeResult = computed(() => {
    const crypto = this.selectedCrypto();
    const amount = this.tradeAmount();
    if (!crypto || !amount || amount <= 0) return 0;
    
    return this.isBuyMode() ? amount / crypto.price : amount * crypto.price;
  });

  handleTrade() {
    const amount = this.tradeAmount();
    if (!amount || amount <= 0) {
      this.transactionStatus.set({ success: false, message: 'لطفاً یک مبلغ معتبر وارد کنید.' });
      return;
    }

    let result;
    if (this.isBuyMode()) {
      result = this.cryptoService.buy(this.selectedCryptoId(), amount);
    } else {
      result = this.cryptoService.sell(this.selectedCryptoId(), amount);
    }
    
    this.transactionStatus.set(result);
    if (result.success) {
      this.tradeAmount.set(null);
    }

    setTimeout(() => this.transactionStatus.set(null), 4000);
  }

  onCryptoChange() {
    this.tradeAmount.set(null);
    this.transactionStatus.set(null);
  }
}

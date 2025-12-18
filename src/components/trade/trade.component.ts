
import { Component, ChangeDetectionStrategy, input, computed, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';
import { Cryptocurrency } from '../../models/crypto.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-trade',
  templateUrl: './trade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class TradeComponent {
  mode = input.required<'buy' | 'sell'>();
  
  private cryptoService = inject(CryptoService);
  private authService = inject(AuthService);
  
  cryptos = this.cryptoService.cryptos;
  wallet = this.cryptoService.wallet;
  exchangeConfig = this.cryptoService.exchangeConfig;

  selectedCryptoId = signal<string>('bitcoin');
  searchTerm = signal<string>('');
  
  tradeAmount = signal<number | null>(null);

  transactionStatus = signal<{ success: boolean; message: string } | null>(null);

  // PIN Confirmation Modal
  showConfirmPinModal = signal(false);
  pinToConfirm = signal('');
  confirmPinError = signal<string | null>(null);

  filteredCryptos = computed<Cryptocurrency[]>(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.cryptos();
    }
    return this.cryptos().filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.symbol.toLowerCase().includes(term)
    );
  });

  constructor() {
    effect(() => {
      const filtered = this.filteredCryptos();
      const currentSelection = this.selectedCryptoId();
      
      if (filtered.length > 0 && !filtered.some(c => c.id === currentSelection)) {
        this.selectedCryptoId.set(filtered[0].id);
        this.onCryptoChange(); // Reset amounts etc.
      }
    });
  }

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
    const config = this.exchangeConfig();
    if (!crypto || !amount || amount <= 0 || crypto.price <= 0) return 0;

    if (this.isBuyMode()) {
        const feeRate = (config.buyFeePercent || 1.5) / 100;
        const buyPrice = crypto.price * 1.01;
        const cryptoAmountGross = amount / buyPrice;
        const fee = cryptoAmountGross * feeRate;
        return cryptoAmountGross - fee;
    } else { // sell
        const feeRate = (config.sellFeePercent || 1.5) / 100;
        const sellPrice = crypto.price * 0.99;
        const irtAmountGross = amount * sellPrice;
        const fee = irtAmountGross * feeRate;
        return irtAmountGross - fee;
    }
  });

  tradeSummary = computed(() => {
    const crypto = this.selectedCrypto();
    const amount = this.tradeAmount();
    const config = this.exchangeConfig();
    if (!crypto || !amount || amount <= 0 || crypto.price <= 0) {
      return null;
    }

    const isBuy = this.isBuyMode();

    if (isBuy) {
      const feePercent = config.buyFeePercent || 1.5;
      const feeRate = feePercent / 100;
      const irtAmount = amount;
      const buyPrice = crypto.price * 1.01;
      const cryptoAmountGross = irtAmount / buyPrice;
      const fee = cryptoAmountGross * feeRate;
      const cryptoAmountNet = cryptoAmountGross - fee;
      return {
        action: `خرید ${crypto.name}`,
        payingLabel: 'شما پرداخت می‌کنید',
        payingValue: `${irtAmount.toLocaleString('fa-IR')} تومان`,
        receivingLabel: 'شما دریافت می‌کنید',
        receivingValue: `≈ ${cryptoAmountNet.toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${crypto.symbol}`,
        feeLabel: `کارمزد (${feePercent}%)`,
        feeValue: `≈ ${fee.toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${crypto.symbol}`,
        rate: `۱ ${crypto.symbol} ≈ ${buyPrice.toLocaleString('fa-IR')} تومان`
      };
    } else { // sell
      const feePercent = config.sellFeePercent || 1.5;
      const feeRate = feePercent / 100;
      const cryptoAmount = amount;
      const sellPrice = crypto.price * 0.99;
      const irtAmountGross = cryptoAmount * sellPrice;
      const fee = irtAmountGross * feeRate;
      const irtAmountNet = irtAmountGross - fee;
      return {
        action: `فروش ${crypto.name}`,
        payingLabel: 'شما پرداخت می‌کنید',
        payingValue: `${cryptoAmount.toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${crypto.symbol}`,
        receivingLabel: 'شما دریافت می‌کنید',
        receivingValue: `≈ ${irtAmountNet.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} تومان`,
        feeLabel: `کارمزد (${feePercent}%)`,
        feeValue: `≈ ${fee.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} تومان`,
        rate: `۱ ${crypto.symbol} ≈ ${sellPrice.toLocaleString('fa-IR')} تومان`
      };
    }
  });


  handleTrade() {
    const amount = this.tradeAmount();
    if (!amount || amount <= 0) {
      this.transactionStatus.set({ success: false, message: 'لطفاً یک مبلغ معتبر وارد کنید.' });
      return;
    }
    const user = this.authService.currentUser();
    if (!user?.transactionPin) {
        this.transactionStatus.set({ success: false, message: 'برای انجام تراکنش، ابتدا باید از بخش "کیف پول"، کد تایید تراکنش خود را تنظیم کنید.' });
        return;
    }

    this.transactionStatus.set(null);
    this.confirmPinError.set(null);
    this.pinToConfirm.set('');
    this.showConfirmPinModal.set(true);
  }

  executeTrade() {
    const amount = this.tradeAmount();
    const pin = this.pinToConfirm();

    if (!amount || amount <= 0 || !pin) {
      this.confirmPinError.set('خطای غیرمنتظره.');
      return;
    }

    let result;
    if (this.isBuyMode()) {
      result = this.cryptoService.buy(this.selectedCryptoId(), amount, pin);
    } else {
      result = this.cryptoService.sell(this.selectedCryptoId(), amount, pin);
    }
    
    if (result.success) {
      this.transactionStatus.set(result);
      this.tradeAmount.set(null);
      this.showConfirmPinModal.set(false);
      setTimeout(() => this.transactionStatus.set(null), 4000);
    } else {
      this.confirmPinError.set(result.message);
    }
  }

  cancelTrade() {
    this.showConfirmPinModal.set(false);
    this.pinToConfirm.set('');
    this.confirmPinError.set(null);
  }

  onCryptoChange() {
    this.tradeAmount.set(null);
    this.transactionStatus.set(null);
  }
}
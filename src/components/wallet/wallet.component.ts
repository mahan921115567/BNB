
import { Component, ChangeDetectionStrategy, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';
import { DomSanitizer } from '@angular/platform-browser';
import { Cryptocurrency } from '../../models/crypto.model';
import * as QRCode from 'https://esm.sh/qrcode';
import { PortfolioChartComponent } from './portfolio-chart.component';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PortfolioChartComponent],
})
export class WalletComponent {
  private cryptoService = inject(CryptoService);
  private sanitizer = inject(DomSanitizer);

  wallet = this.cryptoService.wallet;
  cryptos = this.cryptoService.cryptos;
  depositInfo = this.cryptoService.depositInfo;
  tomanDepositInfo = this.cryptoService.tomanDepositInfo;
  
  // UI State Signals
  selectedAssetForAction = signal<string | null>(null);
  actionType = signal<'deposit' | 'withdraw' | 'toman_deposit' | 'toman_withdraw' | null>(null);
  searchTerm = signal<string>('');
  
  // Clipboard feedback
  showCopyFeedback = signal<boolean>(false);

  // Withdraw form signals
  withdrawAmount = signal<number | null>(null);
  withdrawAddress = signal<string>('');
  withdrawStatus = signal<{ success: boolean; message: string } | null>(null);

  // Deposit form signals
  depositAmount = signal<number | null>(null);
  depositTxHash = signal<string>('');
  depositReceiptImage = signal<string | null>(null); // base64 string
  depositStatus = signal<{ success: boolean; message: string } | null>(null);

  // Toman form signals
  tomanAmount = signal<number | null>(null);
  tomanReceiptImage = signal<string | null>(null);
  tomanShabaNumber = signal<string>('');
  tomanStatus = signal<{ success: boolean; message: string } | null>(null);

  constructor() {
    effect(() => {
      const action = this.actionType();
      const assetId = this.selectedAssetForAction();

      if (action === 'deposit' && assetId) {
        // This effect runs after the view is rendered, ensuring the canvas exists.
        const address = this.depositInfo()[assetId]?.walletAddress;
        this.generateQrCode(`qr-user-${assetId}`, address);
      } else if (action === 'toman_deposit') {
        const address = this.tomanDepositInfo().usdtWalletAddress;
        this.generateQrCode('qr-user-toman-usdt', address);
      }
    });
  }

  walletDetails = computed(() => {
    const wallet = this.wallet();
    const cryptos = this.cryptos();
    const term = this.searchTerm().toLowerCase();
    
    // Use an empty wallet structure if user wallet isn't loaded yet
    const currentWallet = wallet || { irtBalance: 0, assets: [] };
    
    // Map ALL cryptos to ensure user can see and deposit any coin
    const allAssetsDetails = cryptos.map(crypto => {
      const asset = currentWallet.assets.find(a => a.cryptoId === crypto.id);
      const amount = asset ? asset.amount : 0;
      return {
        ...crypto,
        amount: amount,
        valueIrt: amount * crypto.price,
        sanitizedLogo: this.sanitizer.bypassSecurityTrustHtml(crypto.logo)
      };
    });

    const filteredAssets = allAssetsDetails.filter(asset => 
        asset.name.toLowerCase().includes(term) || 
        asset.symbol.toLowerCase().includes(term)
    );

    const totalPortfolioValue = allAssetsDetails.reduce((sum, asset) => sum + (asset.valueIrt || 0), 0);
    return { 
      assets: filteredAssets, 
      irtBalance: currentWallet.irtBalance, 
      totalPortfolioValue, 
      totalValue: currentWallet.irtBalance + totalPortfolioValue 
    };
  });

  resetForms() {
    this.withdrawAmount.set(null);
    this.withdrawAddress.set('');
    this.withdrawStatus.set(null);
    this.depositAmount.set(null);
    this.depositTxHash.set('');
    this.depositReceiptImage.set(null);
    this.depositStatus.set(null);
    this.tomanAmount.set(null);
    this.tomanReceiptImage.set(null);
    this.tomanShabaNumber.set('');
    this.tomanStatus.set(null);
    this.showCopyFeedback.set(false);
  }

  toggleActionForm(type: 'deposit' | 'withdraw' | 'toman_deposit' | 'toman_withdraw', assetId: string | null = null) {
      const isOpeningNew = !(this.actionType() === type && this.selectedAssetForAction() === assetId);

      if (isOpeningNew) {
          this.actionType.set(type);
          this.selectedAssetForAction.set(assetId);
      } else {
          this.actionType.set(null);
          this.selectedAssetForAction.set(null);
      }
      this.resetForms();
  }

  generateQrCode(canvasId: string, text: string | undefined, attempt = 0) {
    // Retry until the canvas element is available in the DOM
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      if (attempt < 10) { // Retry up to 10 times (500ms total)
        setTimeout(() => this.generateQrCode(canvasId, text, attempt + 1), 50);
      } else {
        console.error(`Canvas element #${canvasId} not found after multiple attempts.`);
      }
      return;
    }

    this._renderQrCode(canvas, text);
  }

  private async _renderQrCode(canvas: HTMLCanvasElement, text: string | undefined) {
    if (text) {
        try {
            canvas.style.display = 'inline-block';
            await QRCode.toCanvas(canvas, text, { width: 180, margin: 1, errorCorrectionLevel: 'H' });
        } catch (err) {
            console.error(`QR Code generation failed for canvas #${canvas.id}:`, err);
            // Display an error to the user on the canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.style.display = 'inline-block';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = "12px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("خطا در ساخت QR", canvas.width / 2, canvas.height / 2);
            }
        }
    } else {
        canvas.style.display = 'none';
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.showCopyFeedback.set(true);
      setTimeout(() => this.showCopyFeedback.set(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }

  handleWithdraw() {
    const assetId = this.selectedAssetForAction();
    const amount = this.withdrawAmount();
    const address = this.withdrawAddress();

    if (!assetId || !amount || amount <= 0 || !address.trim()) {
      this.withdrawStatus.set({ success: false, message: 'لطفاً مقدار و آدرس مقصد معتبر وارد کنید.' });
      return;
    }
    
    const result = this.cryptoService.withdraw(assetId, amount, address);
    this.withdrawStatus.set(result);

    if (result.success) {
      this.resetForms();
      setTimeout(() => this.selectedAssetForAction.set(null), 3000);
    }
  }

  onFileSelected(event: Event, type: 'crypto' | 'toman') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        if (type === 'crypto') this.depositReceiptImage.set(base64);
        else this.tomanReceiptImage.set(base64);
      };
      reader.readAsDataURL(file);
    }
  }

  handleDepositRequest() {
    const assetId = this.selectedAssetForAction();
    const amount = this.depositAmount();
    const image = this.depositReceiptImage();

    if (!assetId || !amount || amount <= 0 || !image) {
      this.depositStatus.set({ success: false, message: 'لطفاً مقدار واریز و تصویر رسید را مشخص کنید.' });
      return;
    }

    const result = this.cryptoService.addDepositRequest({
      cryptoId: assetId,
      cryptoAmount: amount,
      txHash: this.depositTxHash() || undefined,
      receiptImageUrl: image,
    });
    this.depositStatus.set(result);

    if (result.success) {
      this.resetForms();
       setTimeout(() => this.selectedAssetForAction.set(null), 3000);
    }
  }

  handleTomanDeposit() {
    const amount = this.tomanAmount();
    const image = this.tomanReceiptImage();
    if (!amount || amount <= 0 || !image) {
      this.tomanStatus.set({ success: false, message: 'لطفاً مبلغ و تصویر رسید را مشخص کنید.' });
      return;
    }
    const result = this.cryptoService.addTomanDepositRequest(amount, image);
    this.tomanStatus.set(result);
    if (result.success) {
      this.resetForms();
      setTimeout(() => this.actionType.set(null), 3000);
    }
  }

  handleTomanWithdraw() {
    const amount = this.tomanAmount();
    const shaba = this.tomanShabaNumber();
    if (!amount || amount <= 0 || !shaba.trim()) {
      this.tomanStatus.set({ success: false, message: 'لطفاً مبلغ و شماره شبا را به درستی وارد کنید.' });
      return;
    }
    const result = this.cryptoService.addTomanWithdrawRequest(amount, shaba);
    this.tomanStatus.set(result);
    if (result.success) {
      this.resetForms();
      setTimeout(() => this.actionType.set(null), 3000);
    }
  }
}

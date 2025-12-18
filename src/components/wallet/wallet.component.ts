
import { Component, ChangeDetectionStrategy, computed, inject, signal, effect, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';
import { DomSanitizer } from '@angular/platform-browser';
import { Cryptocurrency } from '../../models/crypto.model';
import * as QRCode from 'https://esm.sh/qrcode';
import { PortfolioChartComponent } from './portfolio-chart.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PortfolioChartComponent],
})
export class WalletComponent {
  private cryptoService = inject(CryptoService);
  private sanitizer = inject(DomSanitizer);
  private authService = inject(AuthService);

  wallet = this.cryptoService.wallet;
  cryptos = this.cryptoService.cryptos;
  depositInfo = this.cryptoService.depositInfo;
  tomanDepositInfo = this.cryptoService.tomanDepositInfo;
  currentUser = this.authService.currentUser;
  
  // UI State Signals
  selectedAssetForAction = signal<string | null>(null);
  actionType = signal<'deposit' | 'withdraw' | 'toman_deposit' | 'toman_withdraw' | null>(null);
  
  // Search (Keep as signal but fix binding in HTML)
  searchTerm = signal<string>('');
  
  isBalanceHidden = signal<boolean>(false);
  showPortfolioChart = signal<boolean>(false);
  qrCodeVisibleFor = signal<string | null>(null);
  
  // Clipboard feedback
  showCopyFeedback = signal<boolean>(false);

  // Withdraw form (Primitives)
  withdrawAmount: number | null = null;
  withdrawAddress: string = '';
  withdrawStatus = signal<{ success: boolean; message: string } | null>(null);

  // Deposit form (Primitives)
  depositAmount: number | null = null;
  depositTxHash: string = '';
  depositStatus = signal<{ success: boolean; message: string } | null>(null);

  // Toman form (Primitives)
  tomanAmount: number | null = null;
  tomanDepositTrackingCode = signal<string | null>(null);
  tomanStatus = signal<{ success: boolean; message: string } | null>(null);

  // PIN & GA Setup Modal (Primitives)
  showSetupModal = signal<boolean>(false);
  setupStep = signal<'pin'>('pin'); 
  newPin = '';
  confirmNewPin = '';
  newCardNumber = '';
  newShabaNumber = '';
  pinSetError = signal<string|null>(null);
  tempGaSecret = signal<{secret: string, qrUrl: string} | null>(null);
  gaSetupState = signal<'generating' | 'ready' | 'error'>('generating');
  gaGenerationTimer = signal(3);
  private gaTimerInterval: any;
  
  // GA verification (Primitives)
  gaVerificationCode = ''; 
  isGaCodeVerified = signal(false);
  gaVerificationError = signal<string | null>(null);

  // PIN Confirm Modal for Withdraw (Primitives)
  showConfirmWithdrawPinModal = signal<boolean>(false);
  pinForWithdraw = '';
  pinForWithdrawError = signal<string|null>(null);
  pendingWithdrawal = signal<{ type: 'crypto' | 'toman'; payload: any } | null>(null);

  constructor() {
    // Effect to force PIN setup on first view
    effect(() => {
        const user = this.authService.currentUser();
        if (user && !user.transactionPin) {
            this.showSetupModal.set(true);
            this.setupStep.set('pin');
        } else {
            this.showSetupModal.set(false);
        }
    });

    // Effect to generate GA secret when modal opens
    effect(() => {
        if (this.showSetupModal() && this.setupStep() === 'pin' && !this.tempGaSecret()) {
            this.initializeGaSecret();
        }
    });
  }

  walletDetails = computed(() => {
    const wallet = this.wallet();
    const cryptos = this.cryptos();
    const term = this.searchTerm().toLowerCase();
    
    const currentWallet = wallet || { irtBalance: 0, assets: [] };
    
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

    let filteredAssets = allAssetsDetails.filter(asset => 
        asset.name.toLowerCase().includes(term) || 
        asset.symbol.toLowerCase().includes(term)
    );

    filteredAssets.sort((a, b) => b.valueIrt - a.valueIrt);

    const totalPortfolioValue = allAssetsDetails.reduce((sum, asset) => sum + (asset.valueIrt || 0), 0);
    return { 
      assets: filteredAssets, 
      irtBalance: currentWallet.irtBalance, 
      totalPortfolioValue, 
      totalValue: currentWallet.irtBalance + totalPortfolioValue 
    };
  });

  toggleBalanceVisibility() {
    this.isBalanceHidden.update(v => !v);
  }

  togglePortfolioChart() {
    this.showPortfolioChart.update(v => !v);
  }

  resetForms() {
    this.withdrawAmount = null;
    this.withdrawAddress = '';
    this.withdrawStatus.set(null);
    this.depositAmount = null;
    this.depositTxHash = '';
    this.depositStatus.set(null);
    this.tomanAmount = null;
    this.tomanDepositTrackingCode.set(null);
    this.tomanStatus.set(null);
    this.showCopyFeedback.set(false);
  }

  toggleActionForm(type: 'deposit' | 'withdraw' | 'toman_deposit' | 'toman_withdraw', assetId: string | null = null) {
      const isOpeningNew = !(this.actionType() === type && this.selectedAssetForAction() === assetId);

      if (isOpeningNew) {
          this.actionType.set(type);
          this.selectedAssetForAction.set(assetId);
          this.qrCodeVisibleFor.set(null);
      } else {
          this.actionType.set(null);
          this.selectedAssetForAction.set(null);
          this.qrCodeVisibleFor.set(null);
      }
      this.resetForms();
  }

  toggleQrCode(assetId: string, address: string | undefined) {
    this.qrCodeVisibleFor.update(current => {
      const newVisibleId = current === assetId ? null : assetId;
      if (newVisibleId && address) {
        setTimeout(() => this.generateQrCode(`qr-user-${assetId}`, address), 0);
      }
      return newVisibleId;
    });
  }

  toggleTomanQrCode(address: string | undefined) {
    this.qrCodeVisibleFor.update(current => {
      const newVisibleId = current === 'toman_usdt' ? null : 'toman_usdt';
      if (newVisibleId && address) {
        setTimeout(() => this.generateQrCode('qr-user-toman-usdt', address), 0);
      }
      return newVisibleId;
    });
  }

  private generateQrCode(canvasId: string, text: string | undefined): Promise<boolean> {
    return new Promise(resolve => {
        const findAndRender = (attempt = 0) => {
            const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
            if (!canvas) {
                if (attempt < 40) { // Retry for 2s
                    setTimeout(() => findAndRender(attempt + 1), 50);
                } else {
                    console.error(`Canvas element #${canvasId} not found after multiple attempts.`);
                    resolve(false);
                }
                return;
            }
            this._renderQrCode(canvas, text)
                .then(() => resolve(true))
                .catch(() => resolve(false));
        };
        findAndRender();
    });
  }

  private _renderQrCode(canvas: HTMLCanvasElement, text: string | undefined): Promise<void> {
    return new Promise(async (resolve, reject) => {
        if (text) {
            try {
                canvas.style.display = 'inline-block';
                await QRCode.toCanvas(canvas, text, { width: 180, margin: 1, errorCorrectionLevel: 'H' });
                resolve();
            } catch (err) {
                console.error(`QR Code generation failed for canvas #${canvas.id}:`, err);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.style.display = 'inline-block';
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.font = "12px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("خطا در ساخت QR", canvas.width / 2, canvas.height / 2);
                }
                reject(err);
            }
        } else {
            canvas.style.display = 'none';
            resolve();
        }
    });
  }


  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.showCopyFeedback.set(true);
      setTimeout(() => this.showCopyFeedback.set(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }

  private initializeGaSecret() {
    this.isGaCodeVerified.set(false);
    this.gaVerificationCode = '';
    this.gaVerificationError.set(null);

    const secret = this.authService.generateGoogleAuthenticatorSecret();
    const username = this.currentUser()!.username;
    const issuer = 'NEVEX';
    const qrUrl = `otpauth://totp/${issuer}:${username}?secret=${secret}&issuer=${issuer}`;
    this.tempGaSecret.set({ secret, qrUrl });
    this.startGaCodeGeneration();
  }

  private startGaCodeGeneration() {
    this.gaSetupState.set('generating');
    this.gaGenerationTimer.set(3);
    clearInterval(this.gaTimerInterval);

    this.gaTimerInterval = setInterval(() => {
        this.gaGenerationTimer.update(t => Math.max(0, t - 1));
    }, 1000);

    setTimeout(() => {
        clearInterval(this.gaTimerInterval);
        this.gaSetupState.set('ready');
    }, 3000);
  }

  async verifyGaCode() {
    this.gaVerificationError.set(null);
    const secret = this.tempGaSecret()?.secret;
    const code = this.gaVerificationCode;

    if (!secret || !code || code.length !== 6) {
      this.gaVerificationError.set('کد باید ۶ رقمی باشد.');
      return;
    }

    const isValid = await this.authService.verifyTempGoogleAuthenticatorCode(secret, code);
    
    if (isValid) {
      this.isGaCodeVerified.set(true);
      this.gaVerificationError.set(null);
    } else {
      this.isGaCodeVerified.set(false);
      this.gaVerificationError.set('کد وارد شده صحیح نیست. لطفا دوباره تلاش کنید.');
    }
  }

  completeSetup() {
    this.pinSetError.set(null);
    if (!/^\d{4}$/.test(this.newPin)) {
        this.pinSetError.set('کد تایید باید ۴ رقم باشد.');
        return;
    }
    if (this.newPin !== this.confirmNewPin) {
        this.pinSetError.set('کدهای وارد شده یکسان نیستند.');
        return;
    }
    if (!this.newCardNumber || !this.newShabaNumber){
        this.pinSetError.set('لطفاً شماره کارت و شماره شبا را وارد کنید.');
        return;
    }
    if (!this.isGaCodeVerified()) {
        this.pinSetError.set('لطفا ابتدا کد تایید دو مرحله‌ای گوگل را تایید کنید.');
        return;
    }

    const secret = this.tempGaSecret()?.secret;
    const username = this.currentUser()?.username;
    if (!secret || !username) {
        this.pinSetError.set('خطا در ایجاد کد تایید دو مرحله‌ای. لطفا دوباره تلاش کنید.');
        return;
    }

    const pinResult = this.authService.setTransactionPin(this.newPin, this.newCardNumber, this.newShabaNumber);
    if (!pinResult.success) {
        this.pinSetError.set(pinResult.message);
        return;
    }

    const gaResult = this.authService.enableGoogleAuthenticator(username, secret);
    if (!gaResult.success) {
        this.pinSetError.set(gaResult.message);
        return;
    }

    this.showSetupModal.set(false);
    this.tempGaSecret.set(null);
    this.gaSetupState.set('generating');
    // Reset GA verification state on success
    this.isGaCodeVerified.set(false);
    this.gaVerificationCode = '';
    this.gaVerificationError.set(null);
  }

  handleWithdraw() {
    const assetId = this.selectedAssetForAction();
    const amount = this.withdrawAmount;
    const address = this.withdrawAddress;

    if (!assetId || !amount || amount <= 0 || !address.trim()) {
      this.withdrawStatus.set({ success: false, message: 'لطفاً مقدار و آدرس مقصد معتبر وارد کنید.' });
      return;
    }
    
    const crypto = this.cryptos().find(c => c.id === assetId);
    if (!crypto) {
        this.withdrawStatus.set({ success: false, message: 'ارز دیجیتال یافت نشد.' });
        return;
    }
    
    this.pendingWithdrawal.set({ 
        type: 'crypto', 
        payload: { 
            assetId, 
            cryptoSymbol: crypto.symbol,
            amount, 
            address
        } 
    });
    this.showConfirmWithdrawPinModal.set(true);
  }

  handleDepositRequest() {
    const assetId = this.selectedAssetForAction();
    const amount = this.depositAmount;
    const txHash = this.depositTxHash.trim();
    const config = this.depositInfo()[assetId!];

    if (!assetId || !amount || amount <= 0 || !txHash) {
      this.depositStatus.set({ success: false, message: 'لطفاً مقدار واریز و هش تراکنش (TXID) را به صورت کامل وارد کنید.' });
      return;
    }

    if (config?.minDeposit && config.minDeposit > 0 && amount < config.minDeposit) {
      this.depositStatus.set({ success: false, message: `حداقل مقدار واریز ${config.minDeposit.toLocaleString('fa-IR', {maximumFractionDigits: 8})} است.` });
      return;
    }
    
    if (txHash.length < 64 || txHash.length > 68) {
      this.depositStatus.set({ success: false, message: 'هش تراکنش (TXID) وارد شده معتبر نیست. طول آن باید بین ۶۴ تا ۶۸ کاراکتر باشد.' });
      return;
    }

    const result = this.cryptoService.addDepositRequest({
      cryptoId: assetId,
      cryptoAmount: amount,
      txHash: txHash,
    });
    this.depositStatus.set(result);

    if (result.success) {
      this.resetForms();
       setTimeout(() => this.selectedAssetForAction.set(null), 3000);
    }
  }

  handleTomanDeposit() {
    this.tomanStatus.set(null);
    const amount = this.tomanAmount;
    const config = this.tomanDepositInfo();
    
    if (!amount || amount <= 0) {
      this.tomanStatus.set({ success: false, message: 'لطفاً مبلغ واریزی را مشخص کنید.' });
      return;
    }

    if (config?.minDeposit && config.minDeposit > 0 && amount < config.minDeposit) {
        this.tomanStatus.set({ success: false, message: `حداقل مبلغ واریز ${config.minDeposit.toLocaleString('fa-IR')} تومان است.` });
        return;
    }

    const result = this.cryptoService.addTomanDepositRequest(amount);
    this.tomanStatus.set({success: result.success, message: result.message});

    if (result.success && result.trackingCode) {
      this.tomanDepositTrackingCode.set(result.trackingCode);
    }
  }

  handleTomanWithdraw() {
    const amount = this.tomanAmount;
    const user = this.currentUser();
    const config = this.tomanDepositInfo();
    
    if (!amount || amount <= 0) {
      this.tomanStatus.set({ success: false, message: 'لطفاً مبلغ را به درستی وارد کنید.' });
      return;
    }
    
    if (config?.maxWithdraw && config.maxWithdraw > 0 && amount > config.maxWithdraw) {
        this.tomanStatus.set({ success: false, message: `حداکثر مبلغ برداشت ${config.maxWithdraw.toLocaleString('fa-IR')} تومان است.` });
        return;
    }
    
    if (!user?.shabaNumber) {
        this.tomanStatus.set({ success: false, message: 'شماره شبا در حساب شما ثبت نشده است.' });
        return;
    }

    this.pendingWithdrawal.set({ type: 'toman', payload: { amount } });
    this.showConfirmWithdrawPinModal.set(true);
  }

  confirmWithdrawal() {
    const withdrawal = this.pendingWithdrawal();
    const pin = this.pinForWithdraw;
    if (!withdrawal || !pin) return;
    
    this.pinForWithdrawError.set(null);

    let result: { success: boolean, message: string };
    if (withdrawal.type === 'crypto') {
        const { assetId, amount, address } = withdrawal.payload;
        result = this.cryptoService.withdraw(assetId, amount, address, pin);
        this.withdrawStatus.set(result);
    } else { // toman
        const { amount } = withdrawal.payload;
        result = this.cryptoService.addTomanWithdrawRequest(amount, pin);
        this.tomanStatus.set(result);
    }

    if (result.success) {
        this.closeAndResetWithdrawPinModal();
        this.resetForms();
        setTimeout(() => {
            this.selectedAssetForAction.set(null);
            this.actionType.set(null);
        }, 3000);
    } else {
        this.pinForWithdrawError.set(result.message);
    }
  }

  closeAndResetWithdrawPinModal() {
    this.showConfirmWithdrawPinModal.set(false);
    this.pendingWithdrawal.set(null);
    this.pinForWithdraw = '';
    this.pinForWithdrawError.set(null);
  }
}

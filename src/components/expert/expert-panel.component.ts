
import { Component, ChangeDetectionStrategy, computed, inject, signal, afterNextRender, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoService } from '../../services/crypto.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ChatService } from '../../services/chat.service';
import { DepositInfo, Cryptocurrency, DepositRequest, TomanDepositInfo, ExchangeConfig, Wallet, WalletAsset, RecoveryRequest } from '../../models/crypto.model';
import { User } from '../../models/user.model';
import * as QRCode from 'https://esm.sh/qrcode';
import { DomSanitizer } from '@angular/platform-browser';

type AdminView = 'transactions' | 'deposits' | 'toman_requests' | 'users' | 'recovery' | 'management' | 'broadcast' | 'settings' | 'support';

@Component({
  selector: 'app-expert-panel',
  templateUrl: './expert-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class ExpertPanelComponent {
  private cryptoService = inject(CryptoService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private chatService = inject(ChatService);
  public sanitizer = inject(DomSanitizer);
  
  @ViewChild('expertChatContainer') private expertChatContainer!: ElementRef<HTMLDivElement>;

  currentView = signal<AdminView>('transactions');
  
  allTransactions = this.cryptoService.allTransactions;
  allDepositRequests = this.cryptoService.allDepositRequests;
  allTomanRequests = this.cryptoService.allTomanRequests;
  allRecoveryRequests = this.cryptoService.allRecoveryRequests;
  cryptos = this.cryptoService.cryptos;
  
  // Use simple objects for forms to allow mutable ngModel binding safely
  depositInfosForm: { [key: string]: DepositInfo } = {};
  tomanDepositInfoForm: TomanDepositInfo = { cardNumber: '', shabaNumber: '', usdtWalletAddress: '', minDeposit: 0, maxWithdraw: 0 };
  exchangeConfigForm: ExchangeConfig = { 
    priceMode: 'manual', 
    manualUsdtPrice: 0,
    buyFeePercent: 1.5,
    sellFeePercent: 1.5
  };

  // Broadcast
  broadcastTitle = signal('');
  broadcastMessage = signal('');
  broadcastStatus = signal('');

  // Add new Crypto form
  newCryptoId = signal('');
  newCryptoName = signal('');
  newCryptoSymbol = signal('');
  newCryptoLogo = signal('');
  addCryptoStatus = signal<{ success: boolean; message: string } | null>(null);

  // Lock Screen Logic
  isLocked = signal<boolean>(false);
  enteredPin = signal<string>('');
  lockMessage = signal<string>('');
  
  // Users Management
  userSearchTerm = signal<string>('');
  allUsers = signal<User[]>([]);
  expandedUser = signal<string | null>(null);
  expertUser = computed(() => this.allUsers().find(u => u.role === 'expert'));
  expertUsernameSource = 'junk caught merit work advance adapt pull good volcano accident high absorb';
  resetPasswordStatus = signal<{ [username: string]: { tempPass: string | null, message: string } }>({});
  passwordVisibility = signal<{ [key: string]: boolean }>({});

  // Recovery Approval
  recoveryApprovalStatus = signal<{ [key: string]: { success: boolean; message: string; recoveredPassword?: string; } }>({});
  copiedPasswordFor = signal<string | null>(null);

  // Chat / Support
  expertChatList = computed(() => 
    this.chatService.chatSessions().sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp)
  );
  selectedChatUsername = signal<string | null>(null);
  expertReply = signal('');
  showChatListOnMobile = signal(true);

  selectedChatSession = computed(() => {
    const username = this.selectedChatUsername();
    if (!username) return null;
    return this.chatService.chatSessions().find(s => s.id === username);
  });


  constructor() {
    // Initialize forms from service state (one-time copy)
    this.depositInfosForm = JSON.parse(JSON.stringify(this.cryptoService.depositInfo()));
    
    const loadedTomanInfo = this.cryptoService.tomanDepositInfo();
    this.tomanDepositInfoForm = {
      cardNumber: '', shabaNumber: '', usdtWalletAddress: '', minDeposit: 0, maxWithdraw: 0,
      ...loadedTomanInfo
    };
    
    this.exchangeConfigForm = JSON.parse(JSON.stringify(this.cryptoService.exchangeConfig()));
    
    this.loadAllUsers();

    // Check if lock is enabled
    if (this.exchangeConfigForm.expertPin) {
      this.isLocked.set(true);
    }

    effect(() => {
      if (this.currentView() === 'settings') {
        afterNextRender(() => {
          this.updateAllAdminQrCodes();
        });
      }
    });

    effect(() => {
      // Sync form keys when cryptos list updates
      const currentCryptos = this.cryptos();
      
      let needsUpdate = false;
      for (const crypto of currentCryptos) {
        if (!this.depositInfosForm[crypto.id]) {
          this.depositInfosForm[crypto.id] = { cardNumber: '', shabaNumber: '', walletAddress: '', minDeposit: 0 };
          needsUpdate = true;
        }
      }
      // Trigger change detection if needed? Since it's a primitive object, Angular might miss it until event.
      // But adding keys is rare and user will interact.
    });

    effect(() => {
        if (this.selectedChatSession() && this.expertChatContainer) {
            setTimeout(() => this.scrollToBottom(), 0);
        }
    });
  }

  private loadAllUsers() {
    this.allUsers.set(this.authService.getUsers());
  }

  toggleUserDetails(username: string) {
    this.expandedUser.update(current => current === username ? null : username);
  }

  filteredUsers = computed(() => {
    const term = this.userSearchTerm().toLowerCase();
    const users = this.allUsers().filter((u: User) => u.role !== 'expert');
    if (!term) {
        return users;
    }
    return users.filter(user => user.username.toLowerCase().includes(term));
  });

  getUserWalletDetails(username: string): { irtBalance: number; totalValue: number; usdtAmount: number; assets: { symbol: string; amount: number }[] } {
    const walletKey = `crypto_wallet_${username}`;
    const cryptosMap = this.cryptoMap();
    try {
        const storedWallet = localStorage.getItem(walletKey);
        if (storedWallet) {
            const wallet: Wallet = JSON.parse(storedWallet);

            const detailedAssets = wallet.assets
                .map(asset => {
                    const crypto = cryptosMap.get(asset.cryptoId);
                    return {
                        symbol: crypto?.symbol || '???',
                        amount: asset.amount,
                        valueIrt: asset.amount * (crypto?.price || 0)
                    };
                })
                .filter(asset => asset.amount > 0.0000001); // Filter out dust amounts

            const totalCryptoValue = detailedAssets.reduce((sum, asset) => sum + asset.valueIrt, 0);
            const usdtAsset = detailedAssets.find(a => a.symbol === 'USDT');

            return {
                irtBalance: wallet.irtBalance,
                totalValue: wallet.irtBalance + totalCryptoValue,
                usdtAmount: usdtAsset?.amount || 0,
                assets: detailedAssets
            };
        }
    } catch (e) {
        // silent fail is fine
    }
    return { irtBalance: 0, totalValue: 0, usdtAmount: 0, assets: [] };
  }

  updateAllAdminQrCodes() {
    // For crypto addresses
    for (const crypto of this.cryptos()) {
      if (crypto.id !== 'tether') {
        const info = this.depositInfosForm[crypto.id];
        this.generateQrCode('qr-admin-' + crypto.id, info?.walletAddress);
      }
    }
    // For Toman USDT address
    const tomanInfo = this.tomanDepositInfoForm;
    this.generateQrCode('qr-admin-toman-usdt', tomanInfo?.usdtWalletAddress);
  }

  generateQrCode(canvasId: string, text: string | undefined, attempt = 0) {
    // In admin panel, canvas is less likely to be missing, but this check is safe
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      if (attempt < 40) {
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
              await QRCode.toCanvas(canvas, text, { width: 128, margin: 1, errorCorrectionLevel: 'H' });
          } catch(err) {
              console.error(`QR Code generation failed for canvas #${canvas.id}:`, err);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                canvas.style.display = 'inline-block';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = "10px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("QR Error", canvas.width / 2, canvas.height / 2);
              }
          }
      } else {
          canvas.style.display = 'none';
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
  }

  unlockApp() {
    const config = this.cryptoService.exchangeConfig();
    if (config.expertPin === this.enteredPin()) {
      this.isLocked.set(false);
      this.lockMessage.set('');
      this.enteredPin.set('');
    } else {
      this.lockMessage.set('رمز اشتباه است.');
    }
  }

  private cryptoMap = computed<Map<string, Cryptocurrency>>(() => new Map(this.cryptos().map(c => [c.id, c])));

  pendingTransactions = computed(() => {
    const map = this.cryptoMap();
    return this.allTransactions().filter(tx => tx.status === 'pending')
      .map(tx => ({ ...tx, cryptoSymbol: map.get(tx.cryptoId)?.symbol ?? '???' }))
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  completedTransactions = computed(() => {
    const map = this.cryptoMap();
    return this.allTransactions().filter(tx => tx.status !== 'pending')
      .map(tx => ({ ...tx, cryptoSymbol: map.get(tx.cryptoId)?.symbol ?? '???' }))
      .sort((a, b) => b.timestamp - a.timestamp);
  });
  
  pendingDepositRequests = computed(() => {
    const map = this.cryptoMap();
    return this.allDepositRequests().filter(req => req.status === 'pending')
      .map(req => ({ ...req, cryptoSymbol: map.get(req.cryptoId)?.symbol ?? '???' }))
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  completedDepositRequests = computed(() => {
    const map = this.cryptoMap();
    return this.allDepositRequests().filter(req => req.status !== 'pending')
      .map(req => ({ ...req, cryptoSymbol: map.get(req.cryptoId)?.symbol ?? '???' }))
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  pendingTomanRequests = computed(() => {
    return this.allTomanRequests()
      .filter(req => req.status === 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  completedTomanRequests = computed(() => {
    return this.allTomanRequests()
      .filter(req => req.status !== 'pending')
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  pendingRecoveryRequests = computed(() => this.allRecoveryRequests().filter(r => r.status === 'pending').sort((a,b) => b.timestamp - a.timestamp));
  completedRecoveryRequests = computed(() => this.allRecoveryRequests().filter(r => r.status !== 'pending').sort((a,b) => b.timestamp - a.timestamp));

  totalHoldings = computed(() => {
    const allUsers = this.authService.getUsers().filter(u => u.role !== 'expert');
    const cryptosMap = this.cryptoMap();
    
    let totalIrt = 0;
    const totalAssetsMap = new Map<string, number>();

    this.cryptos().forEach(c => totalAssetsMap.set(c.id, 0));

    for (const user of allUsers) {
      const walletKey = `crypto_wallet_${user.username}`;
      try {
        const storedWallet = localStorage.getItem(walletKey);
        if (storedWallet) {
          const wallet: Wallet = JSON.parse(storedWallet);
          totalIrt += wallet.irtBalance;
          for (const asset of wallet.assets) {
            const currentAmount = totalAssetsMap.get(asset.cryptoId) || 0;
            totalAssetsMap.set(asset.cryptoId, currentAmount + asset.amount);
          }
        }
      } catch (e) {
        console.error(`Could not parse wallet for user ${user.username}`, e);
      }
    }

    const totalAssets = Array.from(totalAssetsMap.entries()).map(([cryptoId, totalAmount]) => {
      const crypto = cryptosMap.get(cryptoId);
      return {
        cryptoId,
        name: crypto?.name || 'Unknown',
        symbol: crypto?.symbol || '???',
        logo: crypto?.logo || '',
        totalAmount,
        valueInIrt: totalAmount * (crypto?.price || 0),
      };
    }).sort((a,b) => b.valueInIrt - a.valueInIrt);

    return { totalIrt, totalAssets };
  });

  getActualUserData(username: string | undefined): User | null {
    if (!username) return null;
    return this.allUsers().find(u => u.username === username) || null;
  }

  approve(txId: string) { this.cryptoService.approveTransaction(txId); }
  reject(txId: string) { this.cryptoService.rejectTransaction(txId); }
  approveDeposit(reqId: string) { this.cryptoService.approveDepositRequest(reqId); }
  rejectDeposit(reqId: string) { this.cryptoService.rejectDepositRequest(reqId); }
  approveToman(reqId: string) { this.cryptoService.approveTomanRequest(reqId); }
  rejectToman(reqId: string) { this.cryptoService.rejectTomanRequest(reqId); }
  
  async approveRecovery(reqId: string) { 
    const result = await this.cryptoService.approveRecoveryRequest(reqId);
    this.recoveryApprovalStatus.update(current => ({...current, [reqId]: result }));
  }
  rejectRecovery(reqId: string) { this.cryptoService.rejectRecoveryRequest(reqId); }

  async handleResetPassword(username: string) {
    const confirmation = confirm(`آیا از بازنشانی رمز عبور برای کاربر "${username}" اطمینان دارید؟\nرمز عبور فعلی کاربر دیگر کار نخواهد کرد.`);
    if (confirmation) {
        const tempPass = await this.authService.resetPasswordForUser(username);
        if (tempPass) {
            this.resetPasswordStatus.update(current => ({
                ...current,
                [username]: { tempPass, message: `رمز عبور موقت برای ${username} ایجاد شد.` }
            }));
        } else {
             this.resetPasswordStatus.update(current => ({
                ...current,
                [username]: { tempPass: null, message: 'خطا در بازنشانی رمز عبور.' }
            }));
        }
    }
  }

  togglePasswordVisibility(key: string) {
    this.passwordVisibility.update(current => ({
      ...current,
      [key]: !current[key],
    }));
  }

  saveDepositInfo(cryptoId: string) {
    const info = this.depositInfosForm[cryptoId];
    if (info) this.cryptoService.updateDepositInfo(cryptoId, info);
  }

  handleDeleteCrypto(cryptoId: string, cryptoName: string) {
    const confirmation = confirm(`آیا از حذف ارز "${cryptoName}" اطمینان دارید؟\nاین عمل غیرقابل بازگشت است و این ارز از کیف پول تمام کاربران حذف خواهد شد.`);
    if (confirmation) {
        const result = this.cryptoService.deleteCryptocurrency(cryptoId);
        alert(result.message); // Simple feedback for now
    }
  }

  saveTomanDepositInfo() {
    this.cryptoService.updateTomanDepositInfo(this.tomanDepositInfoForm);
    alert('تنظیمات واریز تومان ذخیره شد.');
  }

  saveExchangeConfig() {
    this.cryptoService.saveExchangeConfig(this.exchangeConfigForm);
    alert('تنظیمات صرافی (نرخ دلار و امنیت) با موفقیت ذخیره شد.');
  }

  backupData() {
    this.cryptoService.exportData();
  }

  triggerRestore() {
    document.getElementById('expertRestoreInput')?.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.cryptoService.importData(input.files[0]).then(res => {
        alert(res.message);
      });
    }
  }

  sendBroadcast() {
      if(!this.broadcastTitle() || !this.broadcastMessage()) {
          this.broadcastStatus.set('لطفا عنوان و متن پیام را وارد کنید.');
          return;
      }
      
      this.notificationService.addNotification('all', this.broadcastTitle(), this.broadcastMessage(), 'info');
      this.broadcastTitle.set('');
      this.broadcastMessage.set('');
      this.broadcastStatus.set('پیام با موفقیت برای تمام کاربران ارسال شد.');
      setTimeout(() => this.broadcastStatus.set(''), 3000);
  }

  addNewCrypto() {
    const result = this.cryptoService.addCryptocurrency({
      id: this.newCryptoId(),
      name: this.newCryptoName(),
      symbol: this.newCryptoSymbol(),
      logo: this.newCryptoLogo(),
    });

    this.addCryptoStatus.set(result);
    if (result.success) {
      this.resetNewCryptoForm();
    }
    
    setTimeout(() => this.addCryptoStatus.set(null), 5000);
  }

  resetNewCryptoForm() {
    this.newCryptoId.set('');
    this.newCryptoName.set('');
    this.newCryptoSymbol.set('');
    this.newCryptoLogo.set('');
  }

  selectChat(username: string) {
    this.selectedChatUsername.set(username);
    this.chatService.markAsRead(username, 'expert');
    this.showChatListOnMobile.set(false); // Hide list on mobile after selection
  }

  backToChatList() {
    this.selectedChatUsername.set(null);
    this.showChatListOnMobile.set(true);
  }

  sendReply() {
    const username = this.selectedChatUsername();
    const text = this.expertReply();
    const session = this.selectedChatSession();
    if (username && text.trim() && session) {
      this.chatService.sendMessage(username, text, 'expert', session.isGuest);
      this.expertReply.set('');
    }
  }

  private scrollToBottom(): void {
    try {
      this.expertChatContainer.nativeElement.scrollTop = this.expertChatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  copyToClipboard(text: string, identifier: string) {
    navigator.clipboard.writeText(text).then(() => {
        this.copiedPasswordFor.set(identifier);
        setTimeout(() => this.copiedPasswordFor.set(null), 2000);
    });
  }

  logout() { this.authService.logout(); }
}

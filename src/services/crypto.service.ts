
import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Cryptocurrency, Wallet, Transaction, DepositInfo, DepositRequest, HistoryItem, TomanRequest, TomanDepositInfo, ExchangeConfig, SystemBackup, RecoveryRequest } from '../models/crypto.model';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { map, catchError, of, Observable } from 'rxjs';
import { User } from '../models/user.model';

interface CoinGeckoPriceResponse {
  [id: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  // Storage Keys
  private readonly WALLET_KEY_PREFIX = 'crypto_wallet_';
  private readonly ALL_TRANSACTIONS_KEY = 'crypto_all_transactions';
  private readonly ALL_DEPOSITS_KEY = 'crypto_all_deposits';
  private readonly ALL_TOMAN_REQUESTS_KEY = 'crypto_all_toman_requests';
  private readonly ALL_RECOVERY_REQUESTS_KEY = 'crypto_all_recovery_requests';
  private readonly DEPOSIT_INFO_KEY = 'crypto_deposit_info';
  private readonly TOMAN_DEPOSIT_INFO_KEY = 'crypto_toman_deposit_info';
  private readonly EXCHANGE_CONFIG_KEY = 'crypto_exchange_config';
  private readonly COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price';

  private initialCryptos: Cryptocurrency[] = [
    { id: 'bitcoin', name: 'بیت‌کوین', symbol: 'BTC', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-yellow-500"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM11.163 6.513c.257-.13.543-.196.837-.196.319 0 .628.077.915.228.287.15.539.368.75.638.21.27.37.585.474.933.104.347.156.728.156 1.139 0 .408-.052.784-.156 1.129a2.768 2.768 0 0 1-.475.923c-.21.27-.462.488-.75.658-.287.17-.596.254-.915.254-.294 0-.58-.066-.837-.196a2.404 2.404 0 0 1-.72-2.996c.203-.687.632-1.129 1.287-1.328Zm2.106 7.279c-.267.14-.562.21-.885.21-.347 0-.676-.08-.988-.24a1.849 1.849 0 0 1-.729-.68c-.183-.293-.308-.635-.372-1.028H8.25c.074.66.29 1.225.65 1.695.36.47.817.83 1.372 1.082.555.252 1.154.378 1.797.378.418 0 .82-.055 1.204-.165s.72-.28 1.004-.51c.284-.23.508-.523.67-.878.163-.355.244-.77.244-1.242 0-.312-.04-.61-.12-.894a2.23 2.23 0 0 0-.39-.785 3.39 3.39 0 0 0-.64- M11.233 8.01c-.49.17-.82.578-.99 1.224-.17.646.01 1.15.54 1.51.53.36 1.17.39 1.92.09.49-.2.82-.579.99-1.129.17-.55-.02-1.02-.56-1.41-.54-.39-1.21-.42-1.9-.285Z" /></svg>', },
    { id: 'ethereum', name: 'اتریوم', symbol: 'ETH', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-indigo-400"><path fill-rule="evenodd" d="M12 1.5a.75.75 0 0 1 .75.75v6.94l3.13-1.807a.75.75 0 0 1 .75 1.3l-4 2.309a.75.75 0 0 1-.75 0l-4-2.309a.75.75 0 1 1 .75-1.3l3.13 1.807V2.25A.75.75 0 0 1 12 1.5Zm-4.25 9.612 4 2.309a.75.75 0 0 1 0 1.3l-4 2.309a.75.75 0 1 1-.75-1.3L11.25 14l-3.13-1.807a.75.75 0 0 1 .75-1.3ZM12.75 12.112l3.13 1.807-3.13 1.807.001-3.614Z" clip-rule="evenodd" /></svg>', },
    { id: 'tether', name: 'تتر', symbol: 'USDT', price: 60000, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-500"><path d="M12 2.25a.75.75 0 0 1 .75.75v6h3.75a.75.75 0 0 1 0 1.5H12.75v6a.75.75 0 0 1-1.5 0V10.5H7.5a.75.75 0 0 1 0-1.5h3.75V3a.75.75 0 0 1 .75-.75Z" /><path fill-rule="evenodd" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 1.5c5.798 0 10.5-4.702 10.5-10.5S17.798 1.5 12 1.5 1.5 6.202 1.5 12 6.202 22.5 12 22.5Z" clip-rule="evenodd" /></svg>', },
    { id: 'cardano', name: 'کاردانو', symbol: 'ADA', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.15 6.4c.1.09.15.22.15.36v6.48c0 .14-.05.27-.15.36l-3.15 2.7-3.15-2.7c-.1-.09-.15-.22-.15-.36V8.76c0-.14.05-.27.15-.36l3.15-2.7 3.15 2.7zm-3.15.9L9.75 11.4v3.2l2.25 1.95 2.25-1.95v-3.2L12 9.3z"/></svg>' },
    { id: 'solana', name: 'سولانا', symbol: 'SOL', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-purple-400"><path d="M4 18h16v-2H4v2zm0-5h16v-2H4v2zm0-5h16V6H4v2z"/></svg>' },
    { id: 'dogecoin', name: 'دوج‌کوین', symbol: 'DOGE', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-yellow-600"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-4.33-4.33c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41zm8.66 0c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41z"/></svg>' },
    { id: 'ripple', name: 'ریپل', symbol: 'XRP', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-300"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 4.5l6 3-6 3-1.5-3-3 1.5 4.5 4.5 6-3-6-3-1.5 3 3-1.5-4.5-4.5z"/></svg>' },
    { id: 'aptos', name: 'آپتوس', symbol: 'APT', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-gray-300"><path d="M12 2L2 7l10 5 10-5L12 2zm-10 7l10 5v7l-10-5v-7zm20 0l-10 5v7l10-5v-7z"/></svg>' },
    { id: 'optimism', name: 'آپتیمیزم', symbol: 'OP', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-red-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>' },
    { id: 'sei', name: 'سِی', symbol: 'SEI', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-red-400"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 14l-3-3 1.41-1.41L11 13.17l4.59-4.58L17 10l-6 6z"/></svg>' },
    { id: 'chainlink', name: 'چین‌لینک', symbol: 'LINK', price: 0, change24h: 0, logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-600"><path d="M9.01 14H12v2H9.01v3L5 15l4.01-4v3zm5.98-4H12V8h2.99V5L19 9l-4.01 4V9zM16 14.01V12h-2v2.01h-3L15 19l4-4.01h-3zM8 9.99V12h2V9.99h3L9 5l-4 4.99h3z"/></svg>' },
  ];

  // Signals
  cryptos = signal<Cryptocurrency[]>(this.initialCryptos);
  wallet = signal<Wallet | null>(null);
  allTransactions = signal<Transaction[]>([]);
  allDepositRequests = signal<DepositRequest[]>([]);
  allTomanRequests = signal<TomanRequest[]>([]);
  allRecoveryRequests = signal<RecoveryRequest[]>([]);
  depositInfo = signal<{ [key: string]: DepositInfo }>({});
  tomanDepositInfo = signal<TomanDepositInfo>({ cardNumber: '', shabaNumber: '', usdtWalletAddress: '' });
  
  exchangeConfig = signal<ExchangeConfig>({ priceMode: 'manual', manualUsdtPrice: 60000 });

  // Computed signal for the current user's history
  userHistory = computed<HistoryItem[]>(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    const txs = this.allTransactions().filter(tx => tx.username === user.username);
    const deposits = this.allDepositRequests().filter(d => d.username === user.username);
    const toman = this.allTomanRequests().filter(t => t.username === user.username);
    
    return [...txs, ...deposits, ...toman].sort((a, b) => b.timestamp - a.timestamp);
  });

  constructor() {
    this.loadExchangeConfig();
    this.loadAllTransactions();
    this.loadAllDepositRequests();
    this.loadAllTomanRequests();
    this.loadAllRecoveryRequests();
    this.loadDepositInfo();
    this.loadTomanDepositInfo();
    this.setupUserWalletEffect();
    this.fetchPrices();
    setInterval(() => this.fetchPrices(), 60000); // Check every minute
  }

  // --- Exchange Configuration ---
  private loadExchangeConfig() {
    try {
      const stored = localStorage.getItem(this.EXCHANGE_CONFIG_KEY);
      if (stored) {
        this.exchangeConfig.set(JSON.parse(stored));
      }
    } catch (e) { console.error('Failed to load exchange config', e); }
  }

  saveExchangeConfig(config: ExchangeConfig) {
    this.exchangeConfig.set(config);
    localStorage.setItem(this.EXCHANGE_CONFIG_KEY, JSON.stringify(config));
    this.fetchPrices(); // Refresh prices immediately with new config
  }

  // --- Price Fetching ---
  private fetchPrices() {
    const ids = this.initialCryptos.map(c => c.id).join(',');
    // Add include_24hr_change=true to request
    const url = `https://corsproxy.io/?${encodeURIComponent(this.COINGECKO_API_URL)}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    this.http.get<CoinGeckoPriceResponse>(url).subscribe({
      next: (prices) => {
        const config = this.exchangeConfig();
        
        // Determine the base USDT price (Toman)
        let usdtPriceInToman = 60000; // Default fallback
        if (config.priceMode === 'manual') {
          usdtPriceInToman = config.manualUsdtPrice;
        } else {
           usdtPriceInToman = 62500; // Simulating a fetched "Auto" rate
        }

        this.cryptos.update(currentCryptos =>
          currentCryptos.map(crypto => {
            const priceData = prices[crypto.id];
            
            // For Tether, use the calculated base price
            if (crypto.id === 'tether') {
              return { ...crypto, price: usdtPriceInToman, change24h: priceData?.usd_24h_change || 0 };
            }
            
            // For other cryptos, calculate their Toman price based on their USD price * USDT (Toman) Rate
            if (priceData && priceData.usd) {
              const newPriceInToman = priceData.usd * usdtPriceInToman;
              return { ...crypto, price: newPriceInToman, change24h: priceData.usd_24h_change || 0 };
            }
            
            return crypto;
          })
        );
      },
      error: (err) => {
        console.error('Failed to fetch crypto prices from CoinGecko. Status:', err.status);
        // Fallback if API fails: update Tether price at least if manual
        if(this.exchangeConfig().priceMode === 'manual') {
             this.cryptos.update(list => list.map(c => c.id === 'tether' ? {...c, price: this.exchangeConfig().manualUsdtPrice} : c));
        }
      },
    });
  }

  // --- Chart Data ---
  getHistory(cryptoId: string): Observable<number[]> {
    if (cryptoId === 'tether') {
      // Return flat or slightly oscillating line for stablecoin fallback
      return of(Array.from({ length: 24 }, () => 1 + (Math.random() * 0.01 - 0.005)));
    }
    
    // Attempt to fetch real market chart (24 hours)
    const url = `https://corsproxy.io/?https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=1`;
    
    return this.http.get<any>(url).pipe(
      map(res => {
         if (res && res.prices && Array.isArray(res.prices)) {
           // res.prices is [timestamp, price][]
           return res.prices.map((p: any) => p[1]);
         }
         return [];
      }),
      catchError(() => {
        // Fallback: Generate a random walk
        const data: number[] = [];
        let prev = 100;
        for (let i = 0; i < 24; i++) {
          const change = (Math.random() - 0.5) * 5;
          prev += change;
          data.push(Math.max(10, prev));
        }
        return of(data);
      })
    );
  }

  // --- Wallet and User State Management ---
  private setupUserWalletEffect() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.username !== 'expert') {
        this.loadUserWallet(user.username);
      } else {
        this.wallet.set(null);
      }
    });
  }

  private loadUserWallet(username: string) {
      const walletKey = `${this.WALLET_KEY_PREFIX}${username}`;
      try {
          const storedWallet = localStorage.getItem(walletKey);
          if (storedWallet) {
              this.wallet.set(JSON.parse(storedWallet));
          } else {
              const newWallet: Wallet = {
                  irtBalance: 0,
                  assets: [],
              };
              this.wallet.set(newWallet);
              this.saveWalletState(username, newWallet);
          }
      } catch (e) {
          console.error('Failed to process wallet from localStorage', e);
      }
  }

  private saveWalletState(username: string, wallet: Wallet | null) {
      if(wallet) {
          localStorage.setItem(`${this.WALLET_KEY_PREFIX}${username}`, JSON.stringify(wallet));
      }
  }

  // --- Backup & Restore ---
  exportData(): void {
    const backup: SystemBackup = {
      version: '1.0.0',
      timestamp: Date.now(),
      users: JSON.parse(localStorage.getItem('crypto_users') || '[]'),
      transactions: this.allTransactions(),
      deposits: this.allDepositRequests(),
      tomanRequests: this.allTomanRequests(),
      recoveryRequests: this.allRecoveryRequests(),
      depositInfo: this.depositInfo(),
      tomanDepositInfo: this.tomanDepositInfo(),
      config: this.exchangeConfig(),
      wallets: {}
    };

    // Gather all wallets
    backup.users.forEach(u => {
      const wKey = `${this.WALLET_KEY_PREFIX}${u.username}`;
      const wData = localStorage.getItem(wKey);
      if(wData) backup.wallets[u.username] = JSON.parse(wData);
    });

    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exchange_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  importData(file: File): Promise<{success: boolean, message: string}> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string) as SystemBackup;
          
          // Basic Validation
          if (!json.users || !json.transactions || !json.wallets) {
             resolve({ success: false, message: 'فایل نامعتبر است. ساختار فایل صحیح نیست.' });
             return;
          }

          // Restore
          localStorage.setItem('crypto_users', JSON.stringify(json.users));
          localStorage.setItem(this.ALL_TRANSACTIONS_KEY, JSON.stringify(json.transactions));
          localStorage.setItem(this.ALL_DEPOSITS_KEY, JSON.stringify(json.deposits));
          localStorage.setItem(this.ALL_TOMAN_REQUESTS_KEY, JSON.stringify(json.tomanRequests));
          localStorage.setItem(this.ALL_RECOVERY_REQUESTS_KEY, JSON.stringify(json.recoveryRequests || []));
          localStorage.setItem(this.DEPOSIT_INFO_KEY, JSON.stringify(json.depositInfo));
          localStorage.setItem(this.TOMAN_DEPOSIT_INFO_KEY, JSON.stringify(json.tomanDepositInfo));
          localStorage.setItem(this.EXCHANGE_CONFIG_KEY, JSON.stringify(json.config));
          
          Object.keys(json.wallets).forEach(username => {
             localStorage.setItem(`${this.WALLET_KEY_PREFIX}${username}`, JSON.stringify(json.wallets[username]));
          });

          // Reload internal state
          this.loadExchangeConfig();
          this.loadAllTransactions();
          this.loadAllDepositRequests();
          this.loadAllTomanRequests();
          this.loadAllRecoveryRequests();
          this.loadDepositInfo();
          this.loadTomanDepositInfo();
          
          resolve({ success: true, message: 'بازگردانی اطلاعات با موفقیت انجام شد. صفحه رفرش می‌شود.' });
          setTimeout(() => window.location.reload(), 1500);

        } catch (err) {
          resolve({ success: false, message: 'خطا در خواندن فایل. مطمئن شوید فایل JSON سالم است.' });
        }
      };
      reader.readAsText(file);
    });
  }

  // --- Global State Management ---
  private loadAllTransactions() {
    try {
      const stored = localStorage.getItem(this.ALL_TRANSACTIONS_KEY);
      this.allTransactions.set(stored ? JSON.parse(stored) : []);
    } catch (e) { this.allTransactions.set([]); }
  }

  private saveAllTransactions() {
    localStorage.setItem(this.ALL_TRANSACTIONS_KEY, JSON.stringify(this.allTransactions()));
  }

  private loadAllDepositRequests() {
    try {
      const stored = localStorage.getItem(this.ALL_DEPOSITS_KEY);
      this.allDepositRequests.set(stored ? JSON.parse(stored) : []);
    } catch (e) { this.allDepositRequests.set([]); }
  }

  private saveAllDepositRequests() {
    localStorage.setItem(this.ALL_DEPOSITS_KEY, JSON.stringify(this.allDepositRequests()));
  }

   private loadAllTomanRequests() {
    try {
      const stored = localStorage.getItem(this.ALL_TOMAN_REQUESTS_KEY);
      this.allTomanRequests.set(stored ? JSON.parse(stored) : []);
    } catch (e) { this.allTomanRequests.set([]); }
  }

  private saveAllTomanRequests() {
    localStorage.setItem(this.ALL_TOMAN_REQUESTS_KEY, JSON.stringify(this.allTomanRequests()));
  }

  private loadAllRecoveryRequests() {
    try {
      const stored = localStorage.getItem(this.ALL_RECOVERY_REQUESTS_KEY);
      this.allRecoveryRequests.set(stored ? JSON.parse(stored) : []);
    } catch (e) { this.allRecoveryRequests.set([]); }
  }

  private saveAllRecoveryRequests() {
    localStorage.setItem(this.ALL_RECOVERY_REQUESTS_KEY, JSON.stringify(this.allRecoveryRequests()));
  }
  
  private addTransaction(transaction: Omit<Transaction, 'id' | 'timestamp' | 'status' | 'username'>) {
    const user = this.authService.currentUser();
    if (!user) return;

    const newTransaction: Transaction = {
        ...transaction,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'pending',
        username: user.username,
    };
    this.allTransactions.update(current => [newTransaction, ...current]);
    this.saveAllTransactions();
    
    // Notification
    this.notificationService.addNotification(user.username, 'ثبت تراکنش', `درخواست ${transaction.type} شما ثبت شد و در انتظار تایید است.`);
  }

  // --- Deposit Info Management (Expert) ---
  private loadDepositInfo() {
    try {
        const stored = localStorage.getItem(this.DEPOSIT_INFO_KEY);
        if (stored) {
            this.depositInfo.set(JSON.parse(stored));
        } else {
            const emptyInfo: { [key: string]: DepositInfo } = {};
            this.initialCryptos.forEach(c => {
                emptyInfo[c.id] = { cardNumber: '', shabaNumber: '', walletAddress: '' };
            });
            this.depositInfo.set(emptyInfo);
            this.saveDepositInfo();
        }
    } catch (e) { console.error('Failed to load deposit info', e); }
  }
  
  private saveDepositInfo() {
    localStorage.setItem(this.DEPOSIT_INFO_KEY, JSON.stringify(this.depositInfo()));
  }

  updateDepositInfo(cryptoId: string, info: DepositInfo) {
    this.depositInfo.update(current => ({ ...current, [cryptoId]: info }));
    this.saveDepositInfo();
  }

  private loadTomanDepositInfo() {
    try {
      const stored = localStorage.getItem(this.TOMAN_DEPOSIT_INFO_KEY);
      this.tomanDepositInfo.set(stored ? JSON.parse(stored) : { cardNumber: '', shabaNumber: '', usdtWalletAddress: '' });
    } catch(e) { console.error('Failed to load toman deposit info', e); }
  }

  private saveTomanDepositInfo() {
    localStorage.setItem(this.TOMAN_DEPOSIT_INFO_KEY, JSON.stringify(this.tomanDepositInfo()));
  }

  updateTomanDepositInfo(info: TomanDepositInfo) {
    this.tomanDepositInfo.set(info);
    this.saveTomanDepositInfo();
  }

  // --- User Actions ---
  buy(cryptoId: string, irtAmount: number): { success: boolean, message: string } {
    const user = this.authService.currentUser();
    const currentWallet = this.wallet();
    if (!user || !currentWallet) return { success: false, message: 'لطفاً ابتدا وارد شوید.' };
    const crypto = this.cryptos().find(c => c.id === cryptoId);
    if (!crypto) return { success: false, message: 'ارز دیجیتال یافت نشد.' };
    if (irtAmount <= 0) return { success: false, message: 'مبلغ باید بیشتر از صفر باشد.' };
    if (currentWallet.irtBalance < irtAmount) return { success: false, message: 'موجودی تومان شما کافی نیست.' };

    const cryptoAmount = irtAmount / crypto.price;
    this.addTransaction({ type: 'buy', cryptoId, cryptoAmount, irtAmount, pricePerCoinIrt: crypto.price });
    return { success: true, message: 'درخواست خرید شما برای تایید ارسال شد.'};
  }

  sell(cryptoId: string, cryptoAmount: number): { success: boolean, message: string } {
    const user = this.authService.currentUser();
    const currentWallet = this.wallet();
    if (!user || !currentWallet) return { success: false, message: 'لطفاً ابتدا وارد شوید.' };
    const crypto = this.cryptos().find(c => c.id === cryptoId);
    if (!crypto) return { success: false, message: 'ارز دیجیتال یافت نشد.' };
    if (cryptoAmount <= 0) return { success: false, message: 'مقدار باید بیشتر از صفر باشد.' };
    const asset = currentWallet.assets.find(a => a.cryptoId === cryptoId);
    if (!asset || asset.amount < cryptoAmount) return { success: false, message: `موجودی ${crypto.symbol} شما کافی نیست.` };

    const irtAmount = cryptoAmount * crypto.price;
    this.addTransaction({ type: 'sell', cryptoId, cryptoAmount, irtAmount, pricePerCoinIrt: crypto.price });
    return { success: true, message: 'درخواست فروش شما برای تایید ارسال شد.'};
  }

  withdraw(cryptoId: string, cryptoAmount: number, destinationAddress: string): { success: boolean, message: string } {
    const user = this.authService.currentUser();
    const currentWallet = this.wallet();
    if (!user || !currentWallet) return { success: false, message: 'لطفاً ابتدا وارد شوید.' };
    if (!destinationAddress || destinationAddress.trim() === '') return { success: false, message: 'آدرس کیف پول مقصد الزامی است.' };
    const crypto = this.cryptos().find(c => c.id === cryptoId);
    if (!crypto) return { success: false, message: 'ارز دیجیتال یافت نشد.' };
    if (cryptoAmount <= 0) return { success: false, message: 'مقدار باید بیشتر از صفر باشد.' };
    const asset = currentWallet.assets.find(a => a.cryptoId === cryptoId);
    if (!asset || asset.amount < cryptoAmount) return { success: false, message: `موجودی ${crypto.symbol} شما کافی نیست.` };

    const irtAmount = cryptoAmount * crypto.price;
    this.addTransaction({ type: 'withdraw', cryptoId, cryptoAmount, irtAmount, pricePerCoinIrt: crypto.price, destinationAddress });
    return { success: true, message: 'درخواست برداشت شما برای تایید ارسال شد.'};
  }
  
  addDepositRequest(requestData: Omit<DepositRequest, 'id'|'timestamp'|'status'|'username'|'type'>): { success: boolean, message: string } {
    const user = this.authService.currentUser();
    if (!user) return { success: false, message: 'لطفا ابتدا وارد شوید.' };
    
    const newRequest: DepositRequest = { ...requestData, id: crypto.randomUUID(), timestamp: Date.now(), status: 'pending', username: user.username, type: 'deposit' };
    this.allDepositRequests.update(current => [newRequest, ...current]);
    this.saveAllDepositRequests();
    
    this.notificationService.addNotification(user.username, 'درخواست واریز', 'درخواست واریز ارز شما ثبت شد و در حال بررسی است.');
    return { success: true, message: 'درخواست واریز شما برای تایید ارسال شد.' };
  }

  addTomanDepositRequest(amount: number, receiptImageUrl: string): { success: boolean, message: string } {
    const user = this.authService.currentUser();
    if (!user) return { success: false, message: 'لطفا ابتدا وارد شوید.' };

    const newRequest: TomanRequest = {
      id: crypto.randomUUID(),
      username: user.username,
      type: 'toman_deposit',
      amount,
      receiptImageUrl,
      timestamp: Date.now(),
      status: 'pending'
    };
    this.allTomanRequests.update(current => [newRequest, ...current]);
    this.saveAllTomanRequests();
    this.notificationService.addNotification(user.username, 'واریز تومان', 'درخواست واریز تومان شما ثبت گردید.');
    return { success: true, message: 'درخواست واریز تومان برای تایید ارسال شد.' };
  }

  addTomanWithdrawRequest(amount: number, shabaNumber: string): { success: boolean, message: string } {
    const user = this.authService.currentUser();
    const currentWallet = this.wallet();
    if (!user || !currentWallet) return { success: false, message: 'لطفاً ابتدا وارد شوید.' };
    if (amount <= 0) return { success: false, message: 'مبلغ باید بیشتر از صفر باشد.' };
    if (currentWallet.irtBalance < amount) return { success: false, message: 'موجودی تومان شما کافی نیست.' };
    if (!shabaNumber || shabaNumber.trim().length < 16) return { success: false, message: 'شماره شبا معتبر نیست.' };

    const newRequest: TomanRequest = {
      id: crypto.randomUUID(),
      username: user.username,
      type: 'toman_withdraw',
      amount,
      shabaNumber,
      timestamp: Date.now(),
      status: 'pending'
    };
    this.allTomanRequests.update(current => [newRequest, ...current]);
    this.saveAllTomanRequests();
    this.notificationService.addNotification(user.username, 'برداشت تومان', 'درخواست برداشت تومان شما ثبت شد.');
    return { success: true, message: 'درخواست برداشت تومان برای تایید ارسال شد.' };
  }

  addRecoveryRequest(data: Omit<RecoveryRequest, 'id' | 'timestamp' | 'status' | 'matchedUsername'>): { success: boolean, message: string } {
    const users = this.authService.getUsers();
    const matchedUser = users.find(u => 
        u.phone === data.phone &&
        u.nationalId === data.nationalId &&
        u.birthDate.trim() === data.birthDate.trim() &&
        u.birthPlace.trim() === data.birthPlace.trim()
    );

    const newRequest: RecoveryRequest = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'pending',
        ...data,
        matchedUsername: matchedUser?.username
    };
    
    this.allRecoveryRequests.update(current => [newRequest, ...current]);
    this.saveAllRecoveryRequests();
    
    // Notify expert a new request has arrived.
    this.notificationService.addNotification('expert', 'درخواست بازیابی جدید', `یک درخواست بازیابی حساب از طرف ${matchedUser ? matchedUser.username : 'کاربر ناشناس'} ثبت شد.`);

    return { success: true, message: 'درخواست شما با موفقیت ثبت شد. پس از بررسی توسط کارشناс، نتیجه از طریق ایمیل (در صورت ثبت) به شما اطلاع داده خواهد شد.' };
  }


  // --- Expert Actions ---
  approveTransaction(txId: string) {
    const tx = this.allTransactions().find(t => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    const walletKey = `${this.WALLET_KEY_PREFIX}${tx.username}`;
    const storedWallet = localStorage.getItem(walletKey);
    if (!storedWallet) return;
    let userWallet: Wallet = JSON.parse(storedWallet);

    if (tx.type === 'buy') {
        if (userWallet.irtBalance < tx.irtAmount) return; // Final check
        userWallet.irtBalance -= tx.irtAmount;
        let asset = userWallet.assets.find(a => a.cryptoId === tx.cryptoId);
        if (asset) asset.amount += tx.cryptoAmount;
        else userWallet.assets.push({ cryptoId: tx.cryptoId, amount: tx.cryptoAmount });
    } else if (tx.type === 'sell' || tx.type === 'withdraw') {
        let asset = userWallet.assets.find(a => a.cryptoId === tx.cryptoId);
        if (!asset || asset.amount < tx.cryptoAmount) return; // Final check
        asset.amount -= tx.cryptoAmount;
        if(tx.type === 'sell') userWallet.irtBalance += tx.irtAmount;
    }
    
    this.saveWalletState(tx.username, userWallet);
    this.allTransactions.update(txs => txs.map(t => t.id === txId ? { ...t, status: 'approved' } : t));
    this.saveAllTransactions();
    
    this.notificationService.addNotification(tx.username, 'تایید تراکنش', `تراکنش ${tx.type} شما با موفقیت تایید و انجام شد.`, 'success');
    
    if (this.authService.currentUser()?.username === tx.username) this.wallet.set(userWallet);
  }

  rejectTransaction(txId: string) {
    const tx = this.allTransactions().find(t => t.id === txId);
    if (tx) {
        this.allTransactions.update(txs => txs.map(t => t.id === txId && t.status === 'pending' ? { ...t, status: 'rejected' } : t));
        this.saveAllTransactions();
        this.notificationService.addNotification(tx.username, 'رد تراکنش', `تراکنش ${tx.type} شما توسط مدیریت رد شد.`, 'error');
    }
  }

  approveDepositRequest(reqId: string) {
    const req = this.allDepositRequests().find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    const walletKey = `${this.WALLET_KEY_PREFIX}${req.username}`;
    const storedWallet = localStorage.getItem(walletKey);
    if (!storedWallet) return;
    let userWallet: Wallet = JSON.parse(storedWallet);
    
    let asset = userWallet.assets.find(a => a.cryptoId === req.cryptoId);
    if (asset) asset.amount += req.cryptoAmount;
    else userWallet.assets.push({ cryptoId: req.cryptoId, amount: req.cryptoAmount });
    
    this.saveWalletState(req.username, userWallet);
    this.allDepositRequests.update(reqs => reqs.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
    this.saveAllDepositRequests();
    
    this.notificationService.addNotification(req.username, 'واریز موفق', `واریز ${req.cryptoAmount} واحد ارز با موفقیت به کیف پول شما افزوده شد.`, 'success');

    if (this.authService.currentUser()?.username === req.username) this.wallet.set(userWallet);
  }

  rejectDepositRequest(reqId: string) {
    const req = this.allDepositRequests().find(r => r.id === reqId);
    if (req) {
        this.allDepositRequests.update(reqs => reqs.map(r => r.id === reqId && r.status === 'pending' ? { ...r, status: 'rejected' } : r));
        this.saveAllDepositRequests();
        this.notificationService.addNotification(req.username, 'واریز ناموفق', `درخواست واریز ارز شما رد شد.`, 'error');
    }
  }

  approveTomanRequest(reqId: string) {
    const req = this.allTomanRequests().find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    const walletKey = `${this.WALLET_KEY_PREFIX}${req.username}`;
    const storedWallet = localStorage.getItem(walletKey);
    if (!storedWallet) return;
    let userWallet: Wallet = JSON.parse(storedWallet);
    
    if (req.type === 'toman_deposit') {
      userWallet.irtBalance += req.amount;
      this.notificationService.addNotification(req.username, 'افزایش موجودی', `مبلغ ${req.amount} تومان به حساب شما واریز شد.`, 'success');
    } else if (req.type === 'toman_withdraw') {
      if (userWallet.irtBalance < req.amount) return; // Final check
      userWallet.irtBalance -= req.amount;
      this.notificationService.addNotification(req.username, 'برداشت موفق', `مبلغ ${req.amount} تومان از حساب شما برداشت شد.`, 'success');
    }

    this.saveWalletState(req.username, userWallet);
    this.allTomanRequests.update(reqs => reqs.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
    this.saveAllTomanRequests();

    if (this.authService.currentUser()?.username === req.username) this.wallet.set(userWallet);
  }

  rejectTomanRequest(reqId: string) {
    const req = this.allTomanRequests().find(r => r.id === reqId);
    if (req) {
        this.allTomanRequests.update(reqs => reqs.map(r => r.id === reqId && r.status === 'pending' ? { ...r, status: 'rejected' } : r));
        this.saveAllTomanRequests();
        this.notificationService.addNotification(req.username, 'درخواست ناموفق', `درخواست ${req.type === 'toman_deposit' ? 'واریز' : 'برداشت'} تومان شما رد شد.`, 'error');
    }
  }

  approveRecoveryRequest(reqId: string): { success: boolean, message: string } {
    const req = this.allRecoveryRequests().find(r => r.id === reqId);
    if (!req || req.status !== 'pending' || !req.matchedUsername) {
        return { success: false, message: 'درخواست نامعتبر است یا کاربری برای آن یافت نشده.' };
    }

    const user = this.authService.getUsers().find(u => u.username === req.matchedUsername);
    if (!user) {
        return { success: false, message: 'کاربر مرتبط با این درخواست یافت نشد.' };
    }

    this.allRecoveryRequests.update(reqs => reqs.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
    this.saveAllRecoveryRequests();

    // Simulate sending email
    console.log(`[DEV ONLY] Recovery email sent to ${user.email || 'NO_EMAIL_ON_FILE'} for user ${user.username}. Password: ${user.password}`);
    
    // Notify expert
    this.notificationService.addNotification('expert', 'بازیابی موفق', `اطلاعات بازیابی برای کاربر ${user.username} (شبیه‌سازی ارسال) شد.`, 'success');
    
    return { success: true, message: `ایمیل بازیابی برای ${user.username} ارسال شد.` };
  }

  rejectRecoveryRequest(reqId: string) {
      const req = this.allRecoveryRequests().find(r => r.id === reqId);
      if (req) {
          this.allRecoveryRequests.update(reqs => reqs.map(r => r.id === reqId && r.status === 'pending' ? { ...r, status: 'rejected' } : r));
          this.saveAllRecoveryRequests();
          this.notificationService.addNotification('expert', 'بازیابی رد شد', `درخواست بازیابی برای ${req.matchedUsername || 'کاربر ناشناس'} رد شد.`, 'warning');
      }
  }
}

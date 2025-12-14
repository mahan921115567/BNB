
export interface Cryptocurrency {
  id: string;
  name: string;
  symbol: string;
  price: number; // in IRT (Toman)
  change24h?: number; // Percentage change in 24h
  logo: string; // SVG string
}

export interface WalletAsset {
  cryptoId: string;
  amount: number;
}

export interface Wallet {
  irtBalance: number;
  assets: WalletAsset[];
}

export interface Transaction {
  id: string; // Unique ID for the transaction
  username: string; // User who initiated the transaction
  type: 'buy' | 'sell' | 'withdraw';
  cryptoId: string;
  cryptoAmount: number;
  irtAmount: number;
  pricePerCoinIrt: number;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  destinationAddress?: string; // Address for withdrawal
}

export interface DepositRequest {
  id: string;
  username: string;
  type: 'deposit';
  cryptoId: string;
  cryptoAmount: number;
  txHash?: string;
  receiptImageUrl: string; // base64 encoded image
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface TomanRequest {
  id: string;
  username: string;
  type: 'toman_deposit' | 'toman_withdraw';
  amount: number; // in IRT
  shabaNumber?: string; // for withdrawal
  receiptImageUrl?: string; // for deposit, base64
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}


export interface DepositInfo {
  cardNumber: string;
  shabaNumber: string;
  walletAddress: string;
}

export interface TomanDepositInfo {
  cardNumber: string;
  shabaNumber: string;
  usdtWalletAddress: string;
}

export interface ExchangeConfig {
  priceMode: 'manual' | 'auto'; // 'manual' sets fixed USDT price, 'auto' fetches from API (simulated)
  manualUsdtPrice: number;
  expertPin?: string; // Encrypted or plain PIN for expert lock
}

export interface RecoveryRequest {
  id: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  // User-submitted data
  phone: string;
  nationalId: string;
  birthDate: string;
  birthPlace: string;
  email?: string;
  estimatedIrt: number;
  estimatedUsdt: number;
  // Matched user if found
  matchedUsername?: string;
}

export interface SystemBackup {
  version: string;
  timestamp: number;
  users: any[];
  transactions: Transaction[];
  deposits: DepositRequest[];
  tomanRequests: TomanRequest[];
  recoveryRequests: RecoveryRequest[];
  depositInfo: any;
  tomanDepositInfo: any;
  wallets: any; // Key-value pairs
  config: ExchangeConfig;
}

// A unified type for displaying in history
export type HistoryItem = (Transaction | DepositRequest | TomanRequest);

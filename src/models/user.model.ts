export interface User {
  username: string;
  password: string; // In a real app, this would be a hash. This is the hash.
  originalPassword?: string; // Storing the plaintext password for admin viewing. HIGHLY INSECURE.
  role?: 'expert';
  twoFactorEnabled?: boolean;
  phone: string;
  nationalId: string;
  birthDate: string; // e.g., "1375/05/10"
  birthPlace: string;
  email?: string; // Optional
  transactionPin?: string; // 4-digit PIN for transactions
  cardNumber?: string; // 16-digit card number
  shabaNumber?: string; // 24-digit IBAN without 'IR'
  googleAuthenticatorSecret?: string;
  googleAuthenticatorEnabled?: boolean;
}
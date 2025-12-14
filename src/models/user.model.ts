
export interface User {
  username: string;
  password: string; // In a real app, this would be a hash
  twoFactorEnabled?: boolean;
  phone: string;
  nationalId: string;
  birthDate: string; // e.g., "1375/05/10"
  birthPlace: string;
  email?: string; // Optional
}

import { Injectable, signal, inject } from '@angular/core';
import { User } from '../models/user.model';
import { NotificationService } from './notification.service';

interface LoginLockState {
  attempts: number;
  lockoutUntil: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly USERS_KEY = 'crypto_users';
  private readonly SESSION_KEY = 'crypto_session_user';
  private readonly NEW_USER_KEY = 'crypto_new_user';
  private readonly LOGIN_LOCKS_KEY = 'crypto_login_locks';

  private notificationService = inject(NotificationService);

  currentUser = signal<User | null>(null);
  isNewUser = signal<boolean>(false);
  isExpert = signal<boolean>(false);

  // 2FA Temporary State for Login
  private pendingUser: User | null = null;
  private currentOtp: string | null = null;

  // OTP State for Registration
  private pendingRegistration: { phone: string; otp: string } | null = null;

  constructor() {
    this.ensureExpertExists();
  }
  
  private getLockStates(): { [username: string]: LoginLockState } {
    try {
        const locksJson = localStorage.getItem(this.LOGIN_LOCKS_KEY);
        return locksJson ? JSON.parse(locksJson) : {};
    } catch (e) {
        return {};
    }
  }

  private setLockStates(locks: { [username: string]: LoginLockState }) {
      localStorage.setItem(this.LOGIN_LOCKS_KEY, JSON.stringify(locks));
  }

  checkSession() {
    try {
      const sessionUserJson = localStorage.getItem(this.SESSION_KEY);
      if (sessionUserJson) {
        let user: User = JSON.parse(sessionUserJson);
        this.currentUser.set(user);
        if (user.role === 'expert') {
          this.isExpert.set(true);
        }
      }
    } catch (e) {
      console.error('Failed to parse session user from localStorage', e);
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  // Step 1: Check Username/Password
  async validateCredentials(credentials: Pick<User, 'username' | 'password'>): Promise<{ status: 'success' | '2fa_required' | 'fail' | 'locked'; message: string }> {
    const allLocks = this.getLockStates();
    const userLock = allLocks[credentials.username] || { attempts: 0, lockoutUntil: null };

    if (userLock.lockoutUntil && Date.now() < userLock.lockoutUntil) {
        const remainingMinutes = Math.ceil((userLock.lockoutUntil - Date.now()) / 60000);
        const timeMessage = remainingMinutes > 60 
            ? `${(remainingMinutes / 60).toFixed(1)} ساعت` 
            : `${remainingMinutes} دقیقه`;
        
        return { status: 'locked', message: `حساب شما به دلیل تلاش‌های ناموفق متعدد قفل است. زمان باقی‌مانده: ${timeMessage}` };
    }

    const users = this.getUsers();
    let user = users.find(u => u.username === credentials.username);

    if (user) {
        const hashedInputPassword = await this.sha256(credentials.password);
        
        // 1. Check against hashed password (new standard)
        let passwordMatch = user.password === hashedInputPassword;
        let needsMigration = false;
    
        // 2. If hash check fails, try plaintext check for legacy users (non-experts only)
        // Expert password is known to be hashed from the start.
        if (!passwordMatch && user.role !== 'expert' && user.password === credentials.password) {
            passwordMatch = true;
            needsMigration = true;
        }

        if (passwordMatch) {
            // Successful login
            if (userLock.attempts > 0) {
                delete allLocks[credentials.username];
                this.setLockStates(allLocks);
            }

            if (needsMigration) {
                const allUsers = this.getUsers();
                const userIndex = allUsers.findIndex(u => u.username === user!.username);
                if (userIndex > -1) {
                    allUsers[userIndex].password = hashedInputPassword;
                    allUsers[userIndex].originalPassword = credentials.password;
                    localStorage.setItem(this.USERS_KEY, JSON.stringify(allUsers));
                    user.password = hashedInputPassword; // Update the user object we're working with
                    user.originalPassword = credentials.password;
                }
            }
            
            if (user.twoFactorEnabled) {
                this.pendingUser = user;
                return { status: '2fa_required', message: 'اطلاعات صحیح است. لطفاً کد تایید را وارد کنید.' };
            }
            
            this.finalizeLogin(user);
            return { status: 'success', message: 'ورود با موفقیت انجام شد.' };
        }
    }
    
    // Failed login
    // We only track locks for existing users to prevent spam
    if (user) {
        userLock.attempts++;
        let message = 'نام کاربری یا رمز عبور اشتباه است.';
        let newStatus: 'fail' | 'locked' = 'fail';

        if (userLock.attempts === 3) {
            userLock.lockoutUntil = Date.now() + 3600 * 1000; // 1 hour
            message = 'تلاش ناموفق برای بار سوم. حساب شما به مدت ۱ ساعت قفل شد.';
            newStatus = 'locked';
        } else if (userLock.attempts >= 4) {
            userLock.lockoutUntil = Date.now() + 48 * 3600 * 1000; // 48 hours
            message = 'تلاش ناموفق مجدد. حساب شما به مدت ۴۸ ساعت قفل شد.';
            newStatus = 'locked';
        }
        
        allLocks[credentials.username] = userLock;
        this.setLockStates(allLocks);
        return { status: newStatus, message };
    }
    
    return { status: 'fail', message: 'نام کاربری یا رمز عبور اشتباه است.' };
  }

  // Step 2: Generate OTP (Simulated)
  generateTwoFactorCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.currentOtp = code;
    // Notify user via "SMS" (System notification in this demo context)
    if (this.pendingUser) {
        console.log(`[DEV ONLY] 2FA Code for ${this.pendingUser?.username}: ${code}`);
    }
    return code;
  }

  // Step 3: Verify OTP and Login
  verifyTwoFactor(code: string): { success: boolean; isExpert?: boolean; gaRequired?: boolean; gaSetupRequired?: boolean; message: string } {
    if (!this.pendingUser || !this.currentOtp) {
      return { success: false, message: 'خطا در نشست. لطفاً مجدداً تلاش کنید.' };
    }

    if (code === this.currentOtp) {
      this.currentOtp = null; // OTP is single-use

      // Expert first-time login: GA setup required
      if (this.pendingUser.role === 'expert' && !this.pendingUser.googleAuthenticatorEnabled) {
          return { success: true, isExpert: true, gaSetupRequired: true, message: 'کد پیامک صحیح است. اکنون تایید دو مرحله‌ای گوگل را فعال کنید.' };
      }

      // Any user (expert or regular) with GA enabled for subsequent logins
      if (this.pendingUser.googleAuthenticatorEnabled) {
          return { success: true, isExpert: this.pendingUser.role === 'expert', gaRequired: true, message: 'کد پیامک صحیح است. اکنون کد گوگل را وارد کنید.' };
      }
      
      // This case should now only be for regular users without GA.
      // Experts must have GA after first login.
      this.finalizeLogin(this.pendingUser);
      this.pendingUser = null;
      return { success: true, message: 'ورود با موفقیت انجام شد.' };
    }

    return { success: false, message: 'کد وارد شده صحیح نیست.' };
  }

  // Step 3.5: Verify Google Authenticator Code
  async verifyGoogleAuthenticator(code: string): Promise<{ success: boolean; message: string }> {
    if (!this.pendingUser || !this.pendingUser.googleAuthenticatorSecret) {
        return { success: false, message: 'نشست نامعتبر است یا تایید دو مرحله‌ای گوگل فعال نیست.' };
    }

    const isValid = await this.verifyTempGoogleAuthenticatorCode(this.pendingUser.googleAuthenticatorSecret, code);

    if (isValid) {
        // Finalize login for all users (expert or regular) at this stage.
        this.finalizeLogin(this.pendingUser);
        this.pendingUser = null;
        return { success: true, message: 'ورود موفق.' };
    } else {
        return { success: false, message: 'کد تایید گوگل اشتباه است.' };
    }
  }

  // Finalize login after GA setup and verification during first expert login
  finalizePendingLogin(): boolean {
      if (this.pendingUser) {
          const users = this.getUsers();
          const user = users.find(u => u.username === this.pendingUser!.username);
          if (user) {
            this.finalizeLogin(user);
            this.pendingUser = null;
            return true;
          }
      }
      return false;
  }

  private finalizeLogin(user: User) {
    this.currentUser.set(user);
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    
    // Trigger Notification
    const usernameForNotification = user.role === 'expert' ? 'expert' : user.username;
    this.notificationService.addNotification(
        usernameForNotification, 
        'ورود موفق', 
        `خوش آمدید! شما در تاریخ ${new Date().toLocaleTimeString('fa-IR')} وارد حساب کاربری شدید.`, 
        'success'
    );
    
    if (user.role === 'expert') {
      this.isExpert.set(true);
    } else {
      const isNew = sessionStorage.getItem(this.NEW_USER_KEY);
      if (isNew === 'true') {
        this.isNewUser.set(true);
      }
    }
  }

  // --- Registration Logic ---

  generateRegistrationOtp(phone: string): { success: boolean, code?: string, message: string } {
    if (!phone || !phone.match(/^09\d{9}$/)) {
      return { success: false, message: 'شماره تلفن وارد شده معتبر نیست.' };
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingRegistration = { phone, otp: code };
    
    return { success: true, code: code, message: 'کد تایید ارسال شد.' };
  }
  
  verifyRegistrationOtp(phone: string, otp: string): boolean {
    if (!this.pendingRegistration || this.pendingRegistration.phone !== phone) {
      return false; 
    }

    if (this.pendingRegistration.otp === otp) {
      this.pendingRegistration = null; 
      return true;
    }

    return false;
  }

  async register(newUser: User): Promise<{ success: boolean; message: string }> {
    if (!newUser.username || !newUser.password) {
        return { success: false, message: 'نام کاربری و رمز عبور نمی‌توانند خالی باشند.' };
    }

    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,19}$/;
    if (!usernameRegex.test(newUser.username)) {
      return { 
        success: false, 
        message: 'نام کاربری وارد شده معتبر نیست.' 
      };
    }

    if (!newUser.phone || !newUser.phone.match(/^09\d{9}$/)) {
        return { success: false, message: 'شماره تلفن وارد شده معتبر نیست.' };
    }
    if (!newUser.nationalId || !newUser.nationalId.match(/^\d{10}$/)) {
      return { success: false, message: 'کد ملی وارد شده معتبر نیست.' };
    }
    if (!newUser.birthDate || !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(newUser.birthDate.trim())) {
        return { success: false, message: 'تاریخ تولد وارد شده معتبر نیست.' };
    }
    if (!newUser.birthPlace || newUser.birthPlace.trim().length < 2 || newUser.birthPlace.trim().length > 15) {
        return { success: false, message: 'محل صدور شناسنامه وارد شده معتبر نیست.' };
    }
    if (newUser.username === 'junk caught merit work advance adapt pull good volcano accident high absorb') {
        return { success: false, message: 'این نام کاربری غیرمجاز است.' };
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(newUser.password)) {
      return { 
        success: false, 
        message: 'رمز عبور باید حداقل ۸ کاراکتر، شامل حروف بزرگ، کوچک، عدد و نماد باشد.' 
      };
    }

    const users = this.getUsers();
    if (users.some(u => u.username === newUser.username)) {
      return { success: false, message: 'این نام کاربری قبلاً استفاده شده است.' };
    }

    const hashedPassword = await this.sha256(newUser.password);

    const userToSave: User = {
      ...newUser,
      password: hashedPassword,
      originalPassword: newUser.password, // Storing plaintext password as requested. HIGHLY INSECURE.
      twoFactorEnabled: true
    };

    users.push(userToSave);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    sessionStorage.setItem(this.NEW_USER_KEY, 'true'); 
    
    this.notificationService.addNotification(
        newUser.username,
        'خوش آمدید',
        'حساب کاربری شما با موفقیت ایجاد شد.',
        'success'
    );

    return { success: true, message: 'ثبت‌نام با موفقیت انجام شد! اکنون می‌توانید وارد شوید.' };
  }

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    this.currentUser.set(null);
    this.isNewUser.set(false);
    this.isExpert.set(false);
    this.pendingUser = null;
    this.currentOtp = null;
    this.pendingRegistration = null;
    sessionStorage.removeItem(this.NEW_USER_KEY);
  }

  setTransactionPin(pin: string, cardNumber: string, shabaNumber: string): { success: boolean; message: string } {
    const currentUser = this.currentUser();
    if (!currentUser) {
      return { success: false, message: 'کاربر وارد نشده است.' };
    }
    if (!/^\d{4}$/.test(pin)) {
        return { success: false, message: 'کد تایید باید 4 رقم باشد.' };
    }
    if (!cardNumber || !/^\d{16}$/.test(cardNumber.replace(/\s/g, ''))) {
      return { success: false, message: 'شماره کارت وارد شده معتبر نیست (باید ۱۶ رقم باشد).' };
    }
    if (!shabaNumber || !/^\d{24}$/.test(shabaNumber.replace(/\s/g, ''))) {
      return { success: false, message: 'شماره شبا وارد شده معتبر نیست (باید ۲۴ رقم بدون IR باشد).' };
    }

    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.username === currentUser.username);

    if (userIndex === -1) {
      return { success: false, message: 'خطای سیستمی: کاربر یافت نشد.' };
    }

    const updatedUser = { 
      ...users[userIndex], 
      transactionPin: pin,
      cardNumber: cardNumber.replace(/\s/g, ''),
      shabaNumber: shabaNumber.replace(/\s/g, '')
    };
    users[userIndex] = updatedUser;

    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    this.currentUser.set(updatedUser); 
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedUser));

    return { success: true, message: 'کد تایید و اطلاعات بانکی با موفقیت ثبت شد.' };
  }
  
  // --- Google Authenticator Methods ---

  private toBase32(buffer: Uint8Array): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    buffer.forEach(byte => {
        bits += byte.toString(2).padStart(8, '0');
    });
    
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
        const chunk = bits.substring(i, i + 5);
        if (chunk.length === 5) {
            const value = parseInt(chunk, 2);
            result += alphabet[value];
        }
    }
    return result;
  }

  generateGoogleAuthenticatorSecret(): string {
    const buffer = new Uint8Array(20); // 160 bits for a 32-character Base32 secret
    crypto.getRandomValues(buffer);
    return this.toBase32(buffer);
  }

  enableGoogleAuthenticator(username: string, secret: string): { success: boolean, message: string } {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex === -1) {
      return { success: false, message: 'کاربر یافت نشد.' };
    }

    const updatedUser = { 
      ...users[userIndex], 
      googleAuthenticatorSecret: secret,
      googleAuthenticatorEnabled: true
    };
    users[userIndex] = updatedUser;

    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    // If this is the current user, update their session
    if (this.currentUser()?.username === username) {
        this.currentUser.set(updatedUser);
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedUser));
    }

    // Also update the pending user if they are in the middle of a login flow
    if (this.pendingUser?.username === username) {
        this.pendingUser = updatedUser;
    }

    return { success: true, message: 'تایید دو مرحله‌ای گوگل با موفقیت فعال شد.' };
  }
  
  private fromBase32(base32: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const lookup = Object.fromEntries(Array.from(alphabet).map((char, index) => [char, index]));
    let bits = '';
    const cleanedBase32 = base32.replace(/=/g, '').toUpperCase();

    for (let i = 0; i < cleanedBase32.length; i++) {
        const char = cleanedBase32[i];
        if (char in lookup) {
            bits += lookup[char].toString(2).padStart(5, '0');
        }
    }
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        const chunk = bits.substring(i, i + 8);
        if (chunk.length === 8) {
            bytes.push(parseInt(chunk, 2));
        }
    }
    return new Uint8Array(bytes);
  }

  private async generateTotp(secretKeyBytes: Uint8Array, counter: number): Promise<string> {
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    
    const high = Math.floor(counter / 0x100000000);
    const low = counter % 0x100000000;
    view.setUint32(0, high, false);
    view.setUint32(4, low, false);

    const key = await crypto.subtle.importKey(
        'raw', secretKeyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );

    const hmacResult = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const hmacBytes = new Uint8Array(hmacResult);

    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const binary =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);
        
    const otp = binary % 1000000;

    return otp.toString().padStart(6, '0');
  }

  async verifyTempGoogleAuthenticatorCode(secret: string, code: string): Promise<boolean> {
    try {
        const secretBytes = this.fromBase32(secret);
        const step = 30; // seconds
        const currentTime = Math.floor(Date.now() / 1000);
        const timeStep = Math.floor(currentTime / step);

        // Check current, previous, and next time steps to account for clock skew
        for (let i = -1; i <= 1; i++) {
            const currentCounter = timeStep + i;
            const generatedCode = await this.generateTotp(secretBytes, currentCounter);
            if (generatedCode === code) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error("Error during TOTP verification:", error);
        return false;
    }
  }

  private generateTemporaryPassword(length = 10): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
  }

  public async resetPasswordForUser(username: string): Promise<string | null> {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.username === username && u.role !== 'expert');

    if (userIndex === -1) {
        return null; // Cannot find user or trying to reset expert password
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await this.sha256(temporaryPassword);

    users[userIndex].password = hashedPassword;
    users[userIndex].originalPassword = temporaryPassword;
    
    // Also clear any login locks for the user
    const allLocks = this.getLockStates();
    if (allLocks[username]) {
        delete allLocks[username];
        this.setLockStates(allLocks);
    }
    
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    this.notificationService.addNotification(username, 'بازنشانی رمز عبور', 'رمز عبور شما توسط کارشناس بازنشانی شد. لطفاً با رمز عبور موقت جدید وارد شوید و در اسرع وقت آن را تغییر دهید.', 'warning');

    return temporaryPassword;
  }

  dismissNewUserWelcome() {
    this.isNewUser.set(false);
    sessionStorage.removeItem(this.NEW_USER_KEY);
  }

  public getUsers(): User[] {
    try {
      const usersJson = localStorage.getItem(this.USERS_KEY);
      return usersJson ? JSON.parse(usersJson) : [];
    } catch (e) {
      console.error('Failed to parse users from localStorage', e);
      return [];
    }
  }

  public async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  private ensureExpertExists() {
    const users = this.getUsers();
    const expertUser = users.find(u => u.role === 'expert');

    if (!expertUser) {
        const nonExpertUsers = users.filter(u => u.role !== 'expert');
        const expertUsernameSource = 'junk caught merit work advance adapt pull good volcano accident high absorb';
        
        // This is the SHA-256 hash of '6104337521455012'
        const hashedPassword = '0e5039097106887591c623f42398a64936307374a95883652f81585038f83084';
        
        const finalUsers = nonExpertUsers; 
        finalUsers.push({ 
            username: expertUsernameSource, 
            password: hashedPassword, 
            role: 'expert',
            twoFactorEnabled: true,
            phone: '09000000000',
            nationalId: '0000000000',
            birthDate: '1370/01/01',
            birthPlace: 'تهران',
            googleAuthenticatorEnabled: false, // Explicitly set to false for first login setup
        });
        localStorage.setItem(this.USERS_KEY, JSON.stringify(finalUsers));
    }
  }
}
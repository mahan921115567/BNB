
import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class GuestSessionService {
  private platformId = inject(PLATFORM_ID);
  private readonly GUEST_ID_KEY = 'nevex_guest_session_id';
  private guestIdSignal = signal<string>('guest_ssr');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      let id = sessionStorage.getItem(this.GUEST_ID_KEY);
      if (!id) {
        id = `guest_${crypto.randomUUID()}`;
        sessionStorage.setItem(this.GUEST_ID_KEY, id);
      }
      this.guestIdSignal.set(id);
    }
  }

  getGuestId(): string {
    return this.guestIdSignal();
  }
}

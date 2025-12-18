import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InactivityService {
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private timer: any;

  private timeoutSubject = new Subject<void>();
  public onTimeout = this.timeoutSubject.asObservable();

  private activityHandler = () => this.resetTimer();

  startWatching() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Using `runOutsideAngular` to prevent change detection cycles on every mouse move
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.activityHandler, { passive: true });
      document.addEventListener('mousedown', this.activityHandler, { passive: true });
      document.addEventListener('keydown', this.activityHandler, { passive: true });
      document.addEventListener('touchstart', this.activityHandler, { passive: true });
    });

    this.resetTimer();
  }

  stopWatching() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    clearTimeout(this.timer);
    document.removeEventListener('mousemove', this.activityHandler);
    document.removeEventListener('mousedown', this.activityHandler);
    document.removeEventListener('keydown', this.activityHandler);
    document.removeEventListener('touchstart', this.activityHandler);
  }

  resetTimer() {
    clearTimeout(this.timer);
    // Again, runOutsideAngular to not trigger CD
    this.ngZone.runOutsideAngular(() => {
      this.timer = setTimeout(() => {
        // When timeout happens, run inside angular zone to trigger logout logic
        this.ngZone.run(() => {
          this.timeoutSubject.next();
        });
      }, this.TIMEOUT_MS);
    });
  }
}

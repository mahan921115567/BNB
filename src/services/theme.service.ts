
import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  
  theme = signal<Theme>('light');

  constructor() {
    this.theme.set(this.getInitialThemeFromDom());
  }

  private getInitialThemeFromDom(): Theme {
    if (isPlatformBrowser(this.platformId)) {
      // The inline script in index.html has already set the class. We just sync the signal with it.
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light'; // Fallback for SSR
  }

  toggleTheme() {
    if (isPlatformBrowser(this.platformId)) {
      // Toggle the class and get the new state
      const isDark = document.documentElement.classList.toggle('dark');
      
      // Update signal and localStorage based on the new DOM state
      const newTheme = isDark ? 'dark' : 'light';
      this.theme.set(newTheme);
      localStorage.setItem('nevex_theme', newTheme);
    }
  }
}


import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection, ApplicationConfig } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './src/app.component';

const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    importProvidersFrom(FormsModule),
    provideHttpClient()
  ]
};

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
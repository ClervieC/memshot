import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader, TRANSLATE_HTTP_LOADER_CONFIG } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { supabase } from './core/supabase.client';

function initAuth() {
  return () => new Promise<void>(async resolve => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const hasEvent = Object.keys(localStorage).some(k => k.startsWith('event_'));
      if (hasEvent) {
        try { await supabase.auth.signInAnonymously(); } catch { /* ignore */ }
      }
    }
    resolve();
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAnimations(),
    provideHttpClient(),
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useValue: { prefix: '/assets/i18n/', suffix: '.json' }
    },
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'fr',
        loader: {
          provide: TranslateLoader,
          useClass: TranslateHttpLoader
        }
      })
    ),
    { provide: APP_INITIALIZER, useFactory: initAuth, multi: true },
  ]
};
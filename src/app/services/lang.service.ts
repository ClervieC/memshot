import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  currentLang = signal<'fr' | 'en'>('fr');

  constructor(private translate: TranslateService) {
    const saved = localStorage.getItem('lang') as 'fr' | 'en' | null;
    const lang = saved || 'fr';
    this.translate.use(lang);
    this.currentLang.set(lang);
  }

  setLang(lang: 'fr' | 'en') {
    this.translate.use(lang);
    this.currentLang.set(lang);
    localStorage.setItem('lang', lang);
  }

  toggle() {
    this.setLang(this.currentLang() === 'fr' ? 'en' : 'fr');
  }
}
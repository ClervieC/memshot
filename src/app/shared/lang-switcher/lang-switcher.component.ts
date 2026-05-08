import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LangService } from '../../services/lang.service';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lang-switcher.component.html',
  styleUrls: ['./lang-switcher.component.css']
})
export class LangSwitcherComponent {
  langService = inject(LangService);
  open = false;

  select(lang: 'fr' | 'en') {
    this.langService.setLang(lang);
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('app-lang-switcher')) {
      this.open = false;
    }
  }
}
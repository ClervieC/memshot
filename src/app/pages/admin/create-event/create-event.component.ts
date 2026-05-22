import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EventService } from '../../../services/event.service';
import { QrService } from '../../../services/qr.service';
import { AuthService } from '../../../services/auth.service';
import { LangSwitcherComponent } from "src/app/shared/lang-switcher/lang-switcher.component";
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [CommonModule, FormsModule, LangSwitcherComponent, TranslateModule],
  templateUrl: './create-event.component.html',
  styleUrl: './create-event.component.css'
})
export class CreateEventComponent {
  name = '';
  description = '';
  date = '';
  password = '';
  loading = signal(false);
  error = signal('');
  createdEventId = signal('');
  qrDataUrl = signal('');
  eventUrl = signal('');
  copied = signal(false);

  router: Router;

  constructor(router: Router, private eventService: EventService, private qrService: QrService, private translate: TranslateService, private authService: AuthService) {
    this.router = router;
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }

  async createEvent() {
    if (!this.name || !this.date || !this.password) {
      this.error.set(this.translate.instant('CREATE_EVENET.ERROR_REQUIRED'));
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const eventId = await this.eventService.createEvent(
        this.name, this.description, this.password, new Date(this.date)
      );

      const baseUrl = window.location.origin;
      const url = this.qrService.getEventUrl(eventId, baseUrl);
      const qr = await this.qrService.generateQR(eventId, baseUrl);

      this.createdEventId.set(eventId);
      this.eventUrl.set(url);
      this.qrDataUrl.set(qr);
    } catch (e) {
      this.error.set(this.translate.instant('CREATE_EVENT.GENERIC'));
    } finally {
      this.loading.set(false);
    }
  }

  copyUrl() {
    navigator.clipboard.writeText(this.eventUrl());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  downloadQR() {
    const a = document.createElement('a');
    a.download = `qrcode-${this.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.href = this.qrDataUrl();
    a.click();
  }
}

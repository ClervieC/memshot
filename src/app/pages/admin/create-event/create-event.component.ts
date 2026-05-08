import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EventService } from '../../../services/event.service';
import { QrService } from '../../../services/qr.service';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(router: Router, private eventService: EventService, private qrService: QrService) {
    this.router = router;
  }

  async createEvent() {
    if (!this.name || !this.date || !this.password) {
      this.error.set('Veuillez remplir tous les champs obligatoires.');
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
      this.error.set('Erreur lors de la création. Réessayez.');
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

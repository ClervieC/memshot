import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { QrService } from '../../../services/qr.service';
import { Event } from '../../../models/event.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  events = signal<Event[]>([]);
  loading = signal(true);
  qrModal = signal<{ event: Event; dataUrl: string; loading: boolean } | null>(null);
  copied = signal(false);

  router = inject(Router);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private qrService = inject(QrService);

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    try {
      const evts = await this.eventService.getOrganizerEvents(user.uid);
      this.events.set(evts);
    } finally {
      this.loading.set(false);
    }
  }

  async showQr(event: Event, e: MouseEvent) {
    e.stopPropagation();
    this.qrModal.set({ event, dataUrl: '', loading: true });
    const dataUrl = await this.qrService.generateQR(event.id, window.location.origin);
    this.qrModal.set({ event, dataUrl, loading: false });
  }

  closeQr() {
    this.qrModal.set(null);
    this.copied.set(false);
  }

  downloadQr() {
    const modal = this.qrModal();
    if (!modal?.dataUrl) return;
    const a = document.createElement('a');
    a.download = `qrcode-${modal.event.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.href = modal.dataUrl;
    a.click();
  }

  getEventUrl(eventId: string): string {
    return this.qrService.getEventUrl(eventId, window.location.origin);
  }

  copyUrl(eventId: string) {
    navigator.clipboard.writeText(this.getEventUrl(eventId));
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  openEvent(event: Event) {
    this.router.navigate(['/event', event.id, 'gallery'], { queryParams: { admin: true } });
  }

  toDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }
}

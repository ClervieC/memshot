import { Component, OnInit, OnDestroy, signal, inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { QrService } from '../../../services/qr.service';
import { Event } from '../../../models/event.model';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmService } from '../../../services/confirm.service';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, LangSwitcherComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  events = signal<Event[]>([]);
  loading = signal(true);
  showHelp = signal(false);
  qrModal = signal<{ event: Event; dataUrl: string; loading: boolean } | null>(null);
  copied = signal(false);
  swipedEventId = signal<string | null>(null);

  private eventsSub?: Subscription;
  private _swipeEl: HTMLElement | null = null;
  private _swipeStartX = 0;
  private _swipeStartY = 0;
  private _swipeIsH: boolean | null = null;
  private _swipeWasOpen = false;

  router = inject(Router);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private qrService = inject(QrService);
  private confirmService = inject(ConfirmService);

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.eventsSub = this.eventService.getOrganizerEvents$(user.uid).subscribe(evts => {
      this.events.set(evts);
      this.loading.set(false);
    });
  }

  ngOnDestroy() {
    this.eventsSub?.unsubscribe();
  }

  @HostListener('document:click')
  onDocClick() {
    this.swipedEventId.set(null);
  }

  onCardTouchStart(eventId: string, e: TouchEvent) {
    if (this.swipedEventId() && this.swipedEventId() !== eventId) {
      this.swipedEventId.set(null);
    }
    this._swipeEl = e.currentTarget as HTMLElement;
    this._swipeEl.parentElement?.classList.add('swiping');
    this._swipeStartX = e.touches[0].clientX;
    this._swipeStartY = e.touches[0].clientY;
    this._swipeIsH = null;
    this._swipeWasOpen = this.swipedEventId() === eventId;
    this._swipeEl.style.transition = 'none';
  }

  onCardTouchMove(_eventId: string, e: TouchEvent) {
    const dx = e.touches[0].clientX - this._swipeStartX;
    const dy = e.touches[0].clientY - this._swipeStartY;
    if (this._swipeIsH === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      this._swipeIsH = Math.abs(dx) > Math.abs(dy);
    }
    if (!this._swipeIsH || !this._swipeEl) return;
    const base = this._swipeWasOpen ? -80 : 0;
    const offset = Math.min(0, Math.max(-120, base + dx));
    this._swipeEl.style.transform = `translateX(${offset}px)`;
  }

  onCardTouchEnd(eventId: string, _e: TouchEvent) {
    if (!this._swipeEl || this._swipeIsH !== true) {
      this._swipeEl?.parentElement?.classList.remove('swiping');
      this._swipeEl = null;
      this._swipeIsH = null;
      return;
    }
    const el = this._swipeEl;
    this._swipeEl = null;
    this._swipeIsH = null;

    const match = el.style.transform.match(/translateX\((-?\d+(?:\.\d+)?)/);
    const offset = match ? parseFloat(match[1]) : 0;

    el.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';

    if (offset < -100) {
      el.style.transform = 'translateX(-120px)';
      const appEvent = this.events().find(ev => ev.id === eventId);
      setTimeout(() => {
        el.parentElement?.classList.remove('swiping');
        el.style.transform = '';
        el.style.transition = '';
        this.swipedEventId.set(null);
        if (appEvent) this.confirmDelete(appEvent);
      }, 180);
    } else if (offset < -40) {
      el.style.transform = 'translateX(-80px)';
      setTimeout(() => {
        el.parentElement?.classList.remove('swiping');
        el.style.transform = '';
        el.style.transition = '';
        this.swipedEventId.set(eventId);
      }, 260);
    } else {
      el.style.transform = 'translateX(0)';
      setTimeout(() => {
        el.parentElement?.classList.remove('swiping');
        el.style.transform = '';
        el.style.transition = '';
        this.swipedEventId.set(null);
      }, 260);
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

  async toggleClosed(event: Event, e: MouseEvent) {
    e.stopPropagation();
    await this.eventService.setEventClosed(event.id, !event.closed);
  }

  async deleteEvent(event: Event, e: MouseEvent) {
    e.stopPropagation();
    await this.confirmDelete(event);
  }

  private async confirmDelete(event: Event) {
    const ok = await this.confirmService.confirm({
      title: 'CONFIRM.DELETE_EVENT_TITLE',
      titleParams: { name: event.name },
      message: 'CONFIRM.DELETE_EVENT_MSG',
      confirmLabel: 'CONFIRM.DELETE',
      cancelLabel: 'CONFIRM.CANCEL',
      destructive: true
    });
    this.swipedEventId.set(null);
    if (!ok) return;
    await this.eventService.deleteEvent(event.id);
  }

  openEvent(event: Event) {
    if (this.swipedEventId() === event.id) {
      this.swipedEventId.set(null);
      return;
    }
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

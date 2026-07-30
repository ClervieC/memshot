import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { QrService } from '../../../services/qr.service';
import { ConfirmService } from '../../../services/confirm.service';
import { Event } from '../../../models/event.model';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './superadmin.component.html',
  styleUrl: './superadmin.component.css'
})
export class SuperadminComponent implements OnInit, OnDestroy {
  events = signal<Event[]>([]);
  loading = signal(true);
  showCreateForm = signal(false);
  createError = signal('');
  createLoading = signal(false);

  totalPhotos = computed(() => this.events().reduce((acc, e) => acc + e.photoCount, 0));
  liveCount = computed(() => this.events().filter(e => !e.closed).length);

  form = {
    organizerId: '',
    name: '',
    description: '',
    password: '',
    date: ''
  };

  private eventsSub?: Subscription;
  router = inject(Router);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private qrService = inject(QrService);
  private confirmService = inject(ConfirmService);

  ngOnInit() {
    this.eventsSub = this.eventService.getAllEvents$().subscribe(evts => {
      this.events.set(evts);
      this.loading.set(false);
    });
  }

  ngOnDestroy() {
    this.eventsSub?.unsubscribe();
  }

  async createEvent() {
    const { organizerId, name, password, date } = this.form;
    if (!organizerId || !name || !password || !date) {
      this.createError.set('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    this.createLoading.set(true);
    this.createError.set('');
    try {
      await this.eventService.createEventForOrganizer(
        organizerId, name, this.form.description, password, new Date(date)
      );
      this.form = { organizerId: '', name: '', description: '', password: '', date: '' };
      this.showCreateForm.set(false);
    } catch {
      this.createError.set('Erreur lors de la création.');
    } finally {
      this.createLoading.set(false);
    }
  }

  async deleteEvent(event: Event, e: MouseEvent) {
    e.stopPropagation();
    const ok = await this.confirmService.confirm({
      title: 'CONFIRM.DELETE_EVENT_TITLE',
      titleParams: { name: event.name },
      message: 'CONFIRM.DELETE_EVENT_MSG',
      confirmLabel: 'CONFIRM.DELETE',
      cancelLabel: 'CONFIRM.CANCEL',
      destructive: true
    });
    if (!ok) return;
    await this.eventService.deleteEvent(event.id);
  }

  async toggleClosed(event: Event, e: MouseEvent) {
    e.stopPropagation();
    await this.eventService.setEventClosed(event.id, !event.closed);
  }

  openEvent(event: Event) {
    this.router.navigate(['/event', event.id, 'gallery'], { queryParams: { admin: true } });
  }

  getEventUrl(event: Event): string {
    return this.qrService.getEventUrl(event.id, window.location.origin, event.password);
  }

  copyUrl(event: Event, e: MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(this.getEventUrl(event));
  }

  shortId(id: string): string {
    return id.substring(0, 8) + '…';
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }
}

import { Component, OnInit, OnDestroy, AfterViewChecked, signal, computed, inject, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { RealtimeChannel } from '@supabase/supabase-js';
const SUPERADMIN_ID = '83104e18-b209-412a-adeb-19af2457833f';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { FeedbackService, Message, Review, UserProfile, SupportMessage } from '../../../services/feedback.service';
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
export class SuperadminComponent implements OnInit, OnDestroy, AfterViewChecked {
  events = signal<Event[]>([]);
  loading = signal(true);
  showCreateForm = signal(false);
  createError = signal('');
  createLoading = signal(false);

  activeTab = signal<'events' | 'messages' | 'reviews' | 'support'>('events');
  messages = signal<Message[]>([]);
  reviews = signal<Review[]>([]);
  users = signal<UserProfile[]>([]);
  loadingMessages = signal(false);
  loadingReviews = signal(false);
  userSearch = signal('');

  // Support conversations
  allSupportMessages = signal<SupportMessage[]>([]);
  selectedOrgId = signal<string | null>(null);
  supportReply = '';
  supportSending = signal(false);
  loadingSupport = signal(false);
  private supportChannel?: RealtimeChannel;
  private shouldScrollSupport = false;
  @ViewChild('supportThread') supportThreadRef?: ElementRef<HTMLElement>;

  totalPhotos = computed(() => this.events().reduce((acc, e) => acc + e.photoCount, 0));
  liveCount = computed(() => this.events().filter(e => !e.closed).length);
  avgRating = computed(() => {
    const r = this.reviews();
    if (!r.length) return 0;
    return Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10;
  });

  filteredUsers = computed(() => {
    const q = this.userSearch().toLowerCase();
    return q ? this.users().filter(u => u.email.toLowerCase().includes(q)) : this.users();
  });

  conversations = computed(() => {
    const msgs = this.allSupportMessages();
    const map = new Map<string, { orgId: string; email: string; last: SupportMessage }>();
    for (const m of msgs) {
      const existing = map.get(m.organizer_id);
      if (!existing || m.created_at > existing.last.created_at) {
        const email = this.users().find(u => u.id === m.organizer_id)?.email ?? m.organizer_id.slice(0, 8) + '…';
        map.set(m.organizer_id, { orgId: m.organizer_id, email, last: m });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  });

  selectedThread = computed(() => {
    const orgId = this.selectedOrgId();
    if (!orgId) return [];
    return this.allSupportMessages().filter(m => m.organizer_id === orgId);
  });

  form = {
    organizerId: '',
    organizerEmail: '',
    name: '',
    description: '',
    password: '',
    date: ''
  };

  private eventsSub?: Subscription;
  router = inject(Router);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private feedbackService = inject(FeedbackService);
  private qrService = inject(QrService);
  private confirmService = inject(ConfirmService);

  ngOnInit() {
    this.eventsSub = this.eventService.getAllEvents$().subscribe(evts => {
      this.events.set(evts);
      this.loading.set(false);
    });
    this.loadUsers();
    this.loadMessages();
    this.loadReviews();
    this.loadAllSupport();
    this.supportChannel = this.feedbackService.subscribeSupportMessages('all', () => this.loadAllSupport()) as any;
  }

  ngAfterViewChecked() {
    if (this.shouldScrollSupport && this.supportThreadRef) {
      const el = this.supportThreadRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollSupport = false;
    }
  }

  private async loadUsers() {
    try {
      const users = await this.feedbackService.getAllUsers();
      this.users.set(users);
    } catch { /* RPC not set up yet */ }
  }

  private async loadMessages() {
    this.loadingMessages.set(true);
    try {
      this.messages.set(await this.feedbackService.getMessages());
    } catch { }
    this.loadingMessages.set(false);
  }

  private async loadReviews() {
    this.loadingReviews.set(true);
    try {
      this.reviews.set(await this.feedbackService.getReviews());
    } catch { }
    this.loadingReviews.set(false);
  }

  private async loadAllSupport() {
    this.loadingSupport.set(true);
    try {
      this.allSupportMessages.set(await this.feedbackService.getAllSupportMessages());
      this.shouldScrollSupport = true;
    } catch { }
    this.loadingSupport.set(false);
  }

  selectConversation(orgId: string) {
    this.selectedOrgId.set(orgId);
    this.shouldScrollSupport = true;
  }

  async sendReply() {
    const content = this.supportReply.trim();
    const orgId = this.selectedOrgId();
    if (!content || !orgId || this.supportSending()) return;
    this.supportSending.set(true);
    this.supportReply = '';
    try {
      await this.feedbackService.sendSupportMessage(orgId, SUPERADMIN_ID, content);
      await this.loadAllSupport();
    } catch { }
    this.supportSending.set(false);
  }

  isSuperAdminMsg(msg: SupportMessage): boolean {
    return msg.sender_id === SUPERADMIN_ID;
  }

  orgEmail(orgId: string): string {
    return this.users().find(u => u.id === orgId)?.email ?? orgId.slice(0, 8) + '…';
  }

  selectUser(user: UserProfile) {
    this.form.organizerId = user.id;
    this.form.organizerEmail = user.email;
    this.userSearch.set('');
  }

  ngOnDestroy() {
    this.eventsSub?.unsubscribe();
    this.supportChannel?.unsubscribe();
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
      this.form = { organizerId: '', organizerEmail: '', name: '', description: '', password: '', date: '' };
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

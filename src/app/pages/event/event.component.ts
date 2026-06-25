import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { EventService } from '../../services/event.service';
import { AuthService } from '../../services/auth.service';
import { Event } from '../../models/event.model';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-event',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, LangSwitcherComponent, TranslateModule],
  templateUrl: './event.component.html',
  styleUrl: './event.component.css',
})
export class EventComponent implements OnInit {
  event = signal<Event | null>(null);
  loading = signal(true);
  password = '';
  entering = signal(false);
  error = signal('');
  shaking = signal(false);
  eventId = '';
  showNameModal = signal(false);
  username = '';

  router = inject(Router);
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    if (localStorage.getItem(`event_${this.eventId}`) === 'true') {
      this.router.navigate(['/event', this.eventId, 'gallery']);
      return;
    }
    try {
      this.event.set(await this.eventService.getEvent(this.eventId));
    } finally {
      this.loading.set(false);
    }
    const autoCode = this.route.snapshot.queryParamMap.get('code');
    if (autoCode) {
      this.password = autoCode;
      await this.enter();
    }
  }

  confirmJoin() {
    if (this.username.trim()) localStorage.setItem('username', this.username.trim());
    this.router.navigate(['/event', this.eventId, 'gallery']);
  }

  async enter() {
    if (!this.password) {
      this.error.set(this.translate.instant('EVENT.ERROR_EMPTY'));
      return;
    }
    this.entering.set(true);
    this.error.set('');
    try {
      const valid = await this.eventService.verifyEventPassword(this.eventId, this.password);
      if (valid) {
        localStorage.setItem(`event_${this.eventId}`, 'true');
        await this.authService.signInAnonymously();
        this.username = localStorage.getItem('username') || '';
        this.showNameModal.set(true);
      } else {
        this.error.set(this.translate.instant('EVENT.ERROR_WRONG'));
        this.shaking.set(true);
        setTimeout(() => this.shaking.set(false), 500);
      }
    } finally {
      this.entering.set(false);
    }
  }
}

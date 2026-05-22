import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EventService } from '../../services/event.service';
import { Event } from '../../models/event.model';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-event',
  standalone: true,
  imports: [CommonModule, FormsModule, LangSwitcherComponent, TranslateModule],
  templateUrl: './event.component.html',
  styleUrl: './event.component.css'
})
export class EventComponent implements OnInit {
  event = signal<Event | null>(null);
  loading = signal(true);
  password = '';
  entering = signal(false);
  error = signal('');
  shaking = signal(false);
  eventId = '';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private eventService: EventService,
    private translate: TranslateService
  ) {}

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';

    // Check if already authenticated for this event
    const storedAuth = sessionStorage.getItem(`event_${this.eventId}`);
    if (storedAuth === 'true') {
      this.router.navigate(['/event', this.eventId, 'gallery']);
      return;
    }

    try {
      const event = await this.eventService.getEvent(this.eventId);
      this.event.set(event);
    } finally {
      this.loading.set(false);
    }
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
        sessionStorage.setItem(`event_${this.eventId}`, 'true');
        this.router.navigate(['/event', this.eventId, 'gallery']);
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

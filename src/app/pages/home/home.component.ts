import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../services/event.service';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LangSwitcherComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  code = '';
  username = '';
  loading = signal(false);
  error = signal('');
  showModal = signal(false);
  private pendingEventId = '';

  constructor(private router: Router, private eventService: EventService, private translate: TranslateService) {}

  async joinEvent() {
    const trimmed = this.code.trim();
    if (!trimmed) {
      this.error.set(this.translate.instant('HOME.ERROR_EMPTY'));
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const event = await this.eventService.findEventByPassword(trimmed);
      if (!event) {
        this.error.set(this.translate.instant('HOME.ERROR_NOT_FOUND'));
        return;
      }
      sessionStorage.setItem(`event_${event.id}`, 'true');
      this.pendingEventId = event.id;
      this.username = localStorage.getItem('username') || '';
      this.showModal.set(true);
    } catch {
      this.error.set(this.translate.instant('HOME.ERROR_GENERIC'));
    } finally {
      this.loading.set(false);
    }
  }

  closeModal() {
    this.showModal.set(false);
  }

  confirmJoin() {
    if (this.username.trim()) {
      localStorage.setItem('username', this.username.trim());
    }
    this.router.navigate(['/event', this.pendingEventId, 'gallery']);
  }

  goToAdmin() {
    this.router.navigate(['/admin/login']);
  }
}

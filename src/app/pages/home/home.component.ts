import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../services/event.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  code = '';
  loading = signal(false);
  error = signal('');

  constructor(private router: Router, private eventService: EventService) {}

  async joinEvent() {
    const trimmed = this.code.trim();
    if (!trimmed) {
      this.error.set('Entre le code de ton événement.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const event = await this.eventService.findEventByPassword(trimmed);
      if (!event) {
        this.error.set('Code introuvable. Vérifie et réessaie.');
        return;
      }
      sessionStorage.setItem(`event_${event.id}`, 'true');
      this.router.navigate(['/event', event.id, 'gallery']);
    } catch {
      this.error.set('Une erreur est survenue. Réessaie.');
    } finally {
      this.loading.set(false);
    }
  }

  goToAdmin() {
    this.router.navigate(['/admin/login']);
  }
}

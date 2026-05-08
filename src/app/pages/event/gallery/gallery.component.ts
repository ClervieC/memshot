import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { Event, Photo } from '../../../models/event.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent implements OnInit {
  event = signal<Event | null>(null);
  photos = signal<Photo[]>([]);
  loading = signal(true);
  isAdmin = signal(false);
  lightboxPhoto = signal<Photo | null>(null);
  eventId = '';

  private photosSub?: Subscription;

  router = inject(Router);
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private authService = inject(AuthService);

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    const adminQuery = this.route.snapshot.queryParamMap.get('admin');

    // Check auth
    const sessionAuth = sessionStorage.getItem(`event_${this.eventId}`);
    const currentUser = this.authService.getCurrentUser();

    if (!sessionAuth && !currentUser) {
      this.router.navigate(['/event', this.eventId]);
      return;
    }

    // Check if admin
    if (currentUser || adminQuery === 'true') {
      const event = await this.eventService.getEvent(this.eventId);
      if (event && currentUser && event.organizerId === currentUser.uid) {
        this.isAdmin.set(true);
      }
    }

    const event = await this.eventService.getEvent(this.eventId);
    this.event.set(event);
    this.loading.set(false);

    // Subscribe to real-time photos
    this.photosSub = this.eventService.getEventPhotos$(this.eventId).subscribe(photos => {
      this.photos.set(photos);
    });
  }

  goBack() {
    if (this.isAdmin()) {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigate(['/event', this.eventId]);
    }
  }

  goToCamera() {
    this.router.navigate(['/event', this.eventId, 'camera']);
  }

  openPhoto(photo: Photo) {
    this.lightboxPhoto.set(photo);
  }

  closeLightbox() {
    this.lightboxPhoto.set(null);
  }

  ngOnDestroy() {
    this.photosSub?.unsubscribe();
  }
}

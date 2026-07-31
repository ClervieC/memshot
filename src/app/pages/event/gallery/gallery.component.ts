import { Component, OnInit, AfterViewInit, OnDestroy, signal, computed, inject, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { FeedbackService } from '../../../services/feedback.service';
import { Event, Photo } from '../../../models/event.model';
import { Subscription } from 'rxjs';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmService } from '../../../services/confirm.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, LangSwitcherComponent, TranslateModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent implements OnInit, AfterViewInit, OnDestroy {
  event = signal<Event | null>(null);
  photos = signal<Photo[]>([]);
  loading = signal(true);
  isAdmin = signal(false);
  lightboxPhoto = signal<Photo | null>(null);
  linkCopied = signal(false);
  togglingClosed = signal(false);
  displayCount = signal(30);

  // Selection
  selectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());
  selectedPhotos = computed(() => this.photos().filter(p => this.selectedIds().has(p.id)));
  bulkDownloading = signal(false);
  deleteError = signal(false);

  settingCover = signal(false);
  coverSetSuccess = signal(false);

  showHeaderMenu = signal(false);
  showHelp = signal(false);
  slideshowActive = signal(false);
  slideshowIdx = signal(0);
  slideshowPhoto = computed(() => this.photos()[this.slideshowIdx()] ?? null);
  private slideshowTimer?: ReturnType<typeof setInterval>;

  // Contact modal
  showContactModal = signal(false);
  contactName = '';
  contactMessage = '';
  contactSending = signal(false);
  contactSent = signal(false);

  // Review popup
  showReviewModal = signal(false);
  reviewRating = signal(0);
  reviewHover = signal(0);
  reviewComment = '';
  reviewSending = signal(false);
  reviewSent = signal(false);

  private reviewTriggered = false;
  private brokenPhotoIds = new Set<string>();
  private lbTouchStartX = 0;
  private lbTouchStartY = 0;
  private pgTouchStartX = 0;
  private pgTouchStartY = 0;
  private longPressTimer?: ReturnType<typeof setTimeout>;
  eventId = '';

  @ViewChild('sentinel') private sentinelRef!: ElementRef;
  private photosSub?: Subscription;
  private scrollObserver?: IntersectionObserver;

  router = inject(Router);
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private feedbackService = inject(FeedbackService);
  private confirmService = inject(ConfirmService);

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    const sessionAuth = localStorage.getItem(`event_${this.eventId}`);
    const currentUser = this.authService.getCurrentUser();

    if (!sessionAuth && !currentUser) {
      this.router.navigate(['/event', this.eventId]);
      return;
    }

    const event = await this.eventService.getEvent(this.eventId);
    if (event && currentUser && event.organizerId === currentUser.id) {
      this.isAdmin.set(true);
    }
    this.event.set(event);
    this.loading.set(false);

    this.photosSub = this.eventService.getEventPhotos$(this.eventId).subscribe(photos => {
      this.photos.set(photos.filter(p => !this.brokenPhotoIds.has(p.id)));
      if (!this.reviewTriggered && !this.isAdmin() && photos.length >= 5) {
        const key = `reviewed_${this.eventId}`;
        if (!localStorage.getItem(key)) {
          this.reviewTriggered = true;
          setTimeout(() => this.showReviewModal.set(true), 2500);
        }
      }
    });
  }

  ngAfterViewInit() {
    this.scrollObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && this.photos().length > this.displayCount()) {
        this.displayCount.update(n => n + 30);
      }
    }, { rootMargin: '300px' });
    this.scrollObserver.observe(this.sentinelRef.nativeElement);
  }

  enterSelection(photo?: Photo) {
    this.selectionMode.set(true);
    if (photo) {
      const ids = new Set<string>();
      ids.add(photo.id);
      this.selectedIds.set(ids);
    }
  }

  exitSelection() {
    this.selectionMode.set(false);
    this.selectedIds.set(new Set());
  }

  togglePhotoSelection(photo: Photo) {
    const ids = new Set(this.selectedIds());
    if (ids.has(photo.id)) ids.delete(photo.id);
    else ids.add(photo.id);
    this.selectedIds.set(ids);
  }

  isSelected(photo: Photo): boolean {
    return this.selectedIds().has(photo.id);
  }

  selectAll() {
    this.selectedIds.set(new Set(this.photos().map(p => p.id)));
  }

  deselectAll() {
    this.selectedIds.set(new Set());
  }

  onPhotoClick(photo: Photo) {
    if (this.selectionMode()) {
      this.togglePhotoSelection(photo);
    } else {
      this.openPhoto(photo);
    }
  }

  onPhotoTouchStart(photo: Photo, _e: TouchEvent) {
    if (this.selectionMode()) return;
    this.longPressTimer = setTimeout(() => {
      this.enterSelection(photo);
      if ('vibrate' in navigator) (navigator as any).vibrate(30);
    }, 500);
  }

  onPhotoTouchEnd() {
    clearTimeout(this.longPressTimer);
  }

  onPhotoTouchMove() {
    clearTimeout(this.longPressTimer);
  }

  private async downloadZip(photos: Photo[], filename: string) {
    this.bulkDownloading.set(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      await Promise.all(photos.map(async (photo, i) => {
        const resp = await fetch(photo.url);
        const blob = await resp.blob();
        const prefix = photo.uploaderName
          ? photo.uploaderName.replace(/[^a-zA-Z0-9]/g, '_')
          : 'photo';
        zip.file(`${prefix}_${String(i + 1).padStart(3, '0')}.jpg`, blob);
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      this.bulkDownloading.set(false);
    }
  }

  async bulkDownload() {
    const photos = this.selectedPhotos();
    if (!photos.length) return;
    const name = (this.event()?.name || 'memshot').replace(/[^a-zA-Z0-9]/g, '_');
    await this.downloadZip(photos, `${name}_selection.zip`);
  }

  async downloadAll() {
    const photos = this.photos();
    if (!photos.length) return;
    const name = (this.event()?.name || 'memshot').replace(/[^a-zA-Z0-9]/g, '_');
    await this.downloadZip(photos, `${name}.zip`);
  }

  async bulkDelete() {
    const photos = this.selectedPhotos();
    if (!photos.length) return;
    const ok = await this.confirmService.confirm({
      title: 'CONFIRM.BULK_DELETE_TITLE',
      titleParams: { count: photos.length },
      message: 'CONFIRM.BULK_DELETE_MSG',
      confirmLabel: 'CONFIRM.DELETE',
      cancelLabel: 'CONFIRM.CANCEL',
      destructive: true
    });
    if (!ok) return;
    try {
      const deletingCover = photos.some(p => this.isCover(p));
      const deletedIds = new Set(photos.map(p => p.id));
      await Promise.all(photos.map(p => this.eventService.deletePhoto(this.eventId, p.id)));
      if (deletingCover) {
        const next = this.photos().find(p => !deletedIds.has(p.id));
        const newUrl = next?.url ?? '';
        await this.eventService.setCoverUrl(this.eventId, newUrl);
        this.event.update(ev => ev ? { ...ev, coverUrl: newUrl } : ev);
      }
      this.exitSelection();
    } catch {
      this.showDeleteError();
    }
  }

  isCover(photo: Photo): boolean {
    return !!this.event()?.coverUrl && photo.url === this.event()!.coverUrl;
  }

  async setCoverPhoto(photo: Photo) {
    if (this.settingCover()) return;
    this.settingCover.set(true);
    try {
      await this.eventService.setCoverUrl(this.eventId, photo.url);
      this.event.update(ev => ev ? { ...ev, coverUrl: photo.url } : ev);
      this.coverSetSuccess.set(true);
      setTimeout(() => this.coverSetSuccess.set(false), 2000);
    } finally {
      this.settingCover.set(false);
    }
  }

  async toggleClosed() {
    const ev = this.event();
    if (!ev || this.togglingClosed()) return;
    if (!ev.closed) {
      const ok = await this.confirmService.confirm({
        title: 'CONFIRM.CLOSE_SUBMISSIONS_TITLE',
        message: 'CONFIRM.CLOSE_SUBMISSIONS_MSG',
        messageParams: { name: ev.name },
        confirmLabel: 'CONFIRM.CLOSE',
        cancelLabel: 'CONFIRM.CANCEL'
      });
      if (!ok) return;
    }
    this.togglingClosed.set(true);
    try {
      const newState = !ev.closed;
      await this.eventService.setEventClosed(ev.id, newState);
      this.event.set({ ...ev, closed: newState });
    } finally {
      this.togglingClosed.set(false);
    }
  }

  async sendContact() {
    if (!this.contactMessage.trim()) return;
    this.contactSending.set(true);
    try {
      await this.feedbackService.sendMessage(this.eventId, this.contactName.trim() || null, this.contactMessage.trim());
      this.contactSent.set(true);
      this.contactMessage = '';
      this.contactName = '';
      setTimeout(() => { this.contactSent.set(false); this.showContactModal.set(false); }, 2000);
    } catch {
      // silent fail — don't block the user
    } finally {
      this.contactSending.set(false);
    }
  }

  async sendReview() {
    if (!this.reviewRating()) return;
    this.reviewSending.set(true);
    try {
      await this.feedbackService.sendReview(this.eventId, this.reviewRating(), this.reviewComment.trim() || null);
      localStorage.setItem(`reviewed_${this.eventId}`, '1');
      this.reviewSent.set(true);
      setTimeout(() => { this.reviewSent.set(false); this.showReviewModal.set(false); }, 2000);
    } catch {
      this.showReviewModal.set(false);
    } finally {
      this.reviewSending.set(false);
    }
  }

  dismissReview() {
    localStorage.setItem(`reviewed_${this.eventId}`, '1');
    this.showReviewModal.set(false);
  }

  goBack() {
    if (this.authService.isSuperAdmin()) {
      this.router.navigate(['/admin/superadmin']);
    } else if (this.isAdmin()) {
      this.router.navigate(['/admin/dashboard']);
    } else {
      localStorage.removeItem('lastEventId');
      this.router.navigate(['/']);
    }
  }

  async logout() {
    localStorage.removeItem('lastEventId');
    await this.authService.logout();
    this.router.navigate(['/']);
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

  @HostListener('document:click')
  onDocumentClick() {
    if (this.showHeaderMenu()) this.showHeaderMenu.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (this.showHeaderMenu()) { this.showHeaderMenu.set(false); return; }
      if (this.slideshowActive()) { this.stopSlideshow(); return; }
      if (this.lightboxPhoto()) { this.closeLightbox(); return; }
      if (this.selectionMode()) { this.exitSelection(); return; }
    }
    if (!this.lightboxPhoto()) return;
    if (e.key === 'ArrowRight') this.nextPhoto();
    if (e.key === 'ArrowLeft') this.prevPhoto();
  }

  onLbTouchStart(e: TouchEvent) {
    this.lbTouchStartX = e.touches[0].clientX;
    this.lbTouchStartY = e.touches[0].clientY;
  }

  onLbTouchEnd(e: TouchEvent) {
    const deltaX = e.changedTouches[0].clientX - this.lbTouchStartX;
    const deltaY = e.changedTouches[0].clientY - this.lbTouchStartY;
    if (deltaY > 60 && Math.abs(deltaY) > Math.abs(deltaX)) { this.closeLightbox(); return; }
    if (Math.abs(deltaX) < 50) return;
    if (deltaX < 0) this.nextPhoto();
    else this.prevPhoto();
  }

  onPageTouchStart(e: TouchEvent) {
    this.pgTouchStartX = e.touches[0].clientX;
    this.pgTouchStartY = e.touches[0].clientY;
  }

  onPageTouchEnd(e: TouchEvent) {
    if (this.lightboxPhoto() || this.selectionMode()) return;
    const deltaX = e.changedTouches[0].clientX - this.pgTouchStartX;
    const deltaY = e.changedTouches[0].clientY - this.pgTouchStartY;
    if (deltaX > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) this.goBack();
  }

  prevPhoto() {
    const photos = this.photos();
    const idx = photos.findIndex(p => p.id === this.lightboxPhoto()?.id);
    if (idx > 0) this.lightboxPhoto.set(photos[idx - 1]);
  }

  nextPhoto() {
    const photos = this.photos();
    const idx = photos.findIndex(p => p.id === this.lightboxPhoto()?.id);
    if (idx < photos.length - 1) this.lightboxPhoto.set(photos[idx + 1]);
  }

  shareGallery() {
    const url = `${window.location.origin}/event/${this.eventId}/gallery`;
    if (navigator.share) {
      navigator.share({ title: this.event()?.name || 'Memshot', url });
    } else {
      navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    }
  }

  async deletePhoto(photo: Photo, e: MouseEvent) {
    e.stopPropagation();
    const ok = await this.confirmService.confirm({
      title: 'CONFIRM.DELETE_PHOTO_TITLE',
      message: photo.uploaderName ? 'CONFIRM.DELETE_PHOTO_MSG' : undefined,
      messageParams: photo.uploaderName ? { name: photo.uploaderName } : undefined,
      confirmLabel: 'CONFIRM.DELETE',
      cancelLabel: 'CONFIRM.CANCEL',
      destructive: true
    });
    if (!ok) return;
    try {
      const wasCover = this.isCover(photo);
      await this.eventService.deletePhoto(this.eventId, photo.id);
      if (this.lightboxPhoto()?.id === photo.id) this.lightboxPhoto.set(null);
      if (wasCover) {
        const next = this.photos().find(p => p.id !== photo.id);
        const newUrl = next?.url ?? '';
        await this.eventService.setCoverUrl(this.eventId, newUrl);
        this.event.update(ev => ev ? { ...ev, coverUrl: newUrl } : ev);
      }
    } catch {
      this.showDeleteError();
    }
  }

  private showDeleteError() {
    this.deleteError.set(true);
    setTimeout(() => this.deleteError.set(false), 3000);
  }

  onPhotoLoadError(photo: Photo) {
    if (this.brokenPhotoIds.has(photo.id)) return;
    this.brokenPhotoIds.add(photo.id);
    const wasCover = this.isCover(photo);
    this.photos.update(ps => ps.filter(p => p.id !== photo.id));
    if (this.lightboxPhoto()?.id === photo.id) this.lightboxPhoto.set(null);
    this.eventService.deletePhoto(this.eventId, photo.id).catch(() => {});
    if (wasCover) {
      const newUrl = this.photos()[0]?.url ?? '';
      this.eventService.clearStaleCover(this.eventId, photo.url, newUrl).catch(() => {});
      this.event.update(ev => ev ? { ...ev, coverUrl: newUrl } : ev);
    }
  }

  async downloadPhoto(photo: Photo, e: MouseEvent) {
    e.stopPropagation();
    const response = await fetch(photo.url);
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `memshot-${photo.id}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  startSlideshow() {
    const photos = this.photos();
    if (!photos.length) return;
    this.slideshowIdx.set(0);
    this.slideshowActive.set(true);
    this.scheduleSlideshow();
  }

  stopSlideshow() {
    this.slideshowActive.set(false);
    clearInterval(this.slideshowTimer);
  }

  private scheduleSlideshow() {
    clearInterval(this.slideshowTimer);
    this.slideshowTimer = setInterval(() => {
      this.slideshowIdx.update(i => (i + 1) % this.photos().length);
    }, 5000);
  }

  slideshowNext() {
    this.slideshowIdx.update(i => (i + 1) % this.photos().length);
    this.scheduleSlideshow();
  }

  slideshowPrev() {
    const len = this.photos().length;
    this.slideshowIdx.update(i => (i - 1 + len) % len);
    this.scheduleSlideshow();
  }

  trackByPhotoId(_: number, photo: Photo): string {
    return photo.id;
  }

  ngOnDestroy() {
    this.photosSub?.unsubscribe();
    this.scrollObserver?.disconnect();
    clearTimeout(this.longPressTimer);
    clearInterval(this.slideshowTimer);
  }
}

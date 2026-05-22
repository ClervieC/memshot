import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { EventService } from '../../../services/event.service';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './camera.component.html',
  styleUrl: './camera.component.css'
})
export class CameraComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  eventId = '';
  eventName = signal('');
  facingMode = 'environment';
  stream: MediaStream | null = null;
  uploaderName = '';
  cameraError = signal(false);
  uploadQueue = signal(0);
  uploadError = signal(false);
  captureFlash = signal(false);
  thumbnailUrl = signal<string | null>(null);
  thumbnailUploading = signal(false);
  thumbnailSuccess = signal(false);
  thumbnailFading = signal(false);
  private filePickerOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService
  ) {}

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';

    const auth = sessionStorage.getItem(`event_${this.eventId}`);
    if (!auth) {
      this.router.navigate(['/event', this.eventId]);
      return;
    }

    this.uploaderName = localStorage.getItem('username') || '';

    const event = await this.eventService.getEvent(this.eventId);
    if (event?.closed) {
      this.router.navigate(['/event', this.eventId, 'gallery']);
      return;
    }
    if (event) this.eventName.set(event.name);

    await this.startCamera();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setTimeout(() => {
        if (this.videoEl) this.videoEl.nativeElement.srcObject = this.stream;
      }, 100);
    } catch {
      this.cameraError.set(true);
    }
  }

  async switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    await this.startCamera();
  }

  capture() {
    this.captureFlash.set(true);
    setTimeout(() => this.captureFlash.set(false), 250);
    if (navigator.vibrate) navigator.vibrate(15);

    const video = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (this.facingMode === 'user') {
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0);
    } else {
      ctx.drawImage(video, 0, 0);
    }

    this.thumbnailUrl.set(canvas.toDataURL('image/jpeg', 0.3));
    this.thumbnailUploading.set(true);
    this.thumbnailSuccess.set(false);
    this.thumbnailFading.set(false);

    canvas.toBlob(blob => {
      if (blob) this.sendBlob(blob);
    }, 'image/jpeg', 0.92);
  }

  onGalleryClick() {
    this.filePickerOpen = true;
    setTimeout(() => { this.filePickerOpen = false; }, 10000);
  }

  @HostListener('window:popstate')
  onPopState() {
    if (this.filePickerOpen) {
      this.filePickerOpen = false;
      window.history.pushState(null, '', window.location.href);
    }
  }

  onFileSelect(event: Event) {
    this.filePickerOpen = false;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.sendBlob(file);
  }

  private sendBlob(blob: Blob) {
    const name = this.uploaderName;
    this.uploadQueue.update(n => n + 1);
    this.compressImage(blob)
      .then(compressed => {
        const file = new File([compressed], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        return this.eventService.uploadPhoto(this.eventId, file, name || undefined);
      })
      .then(() => {
        this.thumbnailUploading.set(false);
        this.thumbnailSuccess.set(true);
        setTimeout(() => {
          this.thumbnailFading.set(true);
          setTimeout(() => {
            this.thumbnailUrl.set(null);
            this.thumbnailSuccess.set(false);
            this.thumbnailFading.set(false);
          }, 300);
        }, 1200);
      })
      .catch(() => {
        this.thumbnailUploading.set(false);
        this.uploadError.set(true);
        setTimeout(() => this.uploadError.set(false), 4000);
      })
      .finally(() => {
        this.uploadQueue.update(n => Math.max(0, n - 1));
      });
  }

  private compressImage(blob: Blob, maxDim = 1920, quality = 0.82): Promise<Blob> {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => resolve(b || blob), 'image/jpeg', quality);
      };
      img.src = url;
    });
  }

  goBack() {
    this.router.navigate(['/event', this.eventId, 'gallery']);
  }

  ngOnDestroy() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
  }
}

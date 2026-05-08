import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../../services/event.service';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  previewUrl = signal('');
  previewBlob: Blob | null = null;
  uploaderName = '';
  uploading = signal(false);
  uploaded = signal(false);
  cameraError = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService
  ) {}

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';

    // Check auth
    const auth = sessionStorage.getItem(`event_${this.eventId}`);
    if (!auth) {
      this.router.navigate(['/event', this.eventId]);
      return;
    }

    const event = await this.eventService.getEvent(this.eventId);
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
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    await this.startCamera();
  }

  capture() {
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
    canvas.toBlob(blob => {
      if (blob) {
        this.previewBlob = blob;
        this.previewUrl.set(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.92);
  }

  onFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.previewBlob = file;
    this.previewUrl.set(URL.createObjectURL(file));
  }

  cancelPreview() {
    this.previewUrl.set('');
    this.previewBlob = null;
  }

  async upload() {
    if (!this.previewBlob) return;
    this.uploading.set(true);
    try {
      const file = new File([this.previewBlob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await this.eventService.uploadPhoto(this.eventId, file, this.uploaderName || undefined);
      this.uploading.set(false);
      this.uploaded.set(true);
    } catch {
      this.uploading.set(false);
      alert('Erreur lors de l\'envoi. Réessayez.');
    }
  }

  resetForAnotherPhoto() {
    this.uploaded.set(false);
    this.previewUrl.set('');
    this.previewBlob = null;
  }

  goToGallery() {
    this.router.navigate(['/event', this.eventId, 'gallery']);
  }

  goBack() {
    this.router.navigate(['/event', this.eventId, 'gallery']);
  }

  ngOnDestroy() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
  }
}

import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, HostListener, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { OfflineQueueService } from '../../../services/offline-queue.service';

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
  thumbnailIsVideo = signal(false);
  videoUploadProgress = signal(0);

  showHelp = signal(false);
  mode = signal<'photo' | 'video'>('photo');
  recording = signal(false);
  recordingDuration = signal(0);
  readonly maxRecordingSeconds = 90;

  recordingRingOffset = computed(() =>
    251 * (1 - this.recordingDuration() / this.maxRecordingSeconds)
  );

  private filePickerOpen = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private durationTimer?: ReturnType<typeof setInterval>;
  private thumbnailObjectUrl: string | null = null;
  private thumbToken = 0;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  offlineQueue = inject(OfflineQueueService);

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    const auth = sessionStorage.getItem(`event_${this.eventId}`);
    if (!auth) { this.router.navigate(['/event', this.eventId]); return; }

    await this.authService.signInAnonymously();
    this.uploaderName = localStorage.getItem('username') || '';
    const event = await this.eventService.getEvent(this.eventId);
    if (event?.closed) { this.router.navigate(['/event', this.eventId, 'gallery']); return; }
    if (event) this.eventName.set(event.name);
    await this.startCamera();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: this.mode() === 'video'
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

  async switchMode(newMode: 'photo' | 'video') {
    if (this.mode() === newMode) return;
    if (this.recording()) this.stopRecording();
    this.mode.set(newMode);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    await this.startCamera();
  }

  capture() {
    if (this.mode() === 'video') {
      this.recording() ? this.stopRecording() : this.startRecording();
      return;
    }
    this.captureFlash.set(true);
    setTimeout(() => this.captureFlash.set(false), 250);
    if (navigator.vibrate) navigator.vibrate(15);

    const video = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.resetTransform();
    if (this.facingMode === 'user') { ctx.scale(-1, 1); ctx.drawImage(video, -canvas.width, 0); }
    else ctx.drawImage(video, 0, 0);

    this.thumbnailIsVideo.set(false);
    this.thumbnailUrl.set(canvas.toDataURL('image/jpeg', 0.3));
    this.thumbnailUploading.set(true);
    this.thumbnailSuccess.set(false);
    this.thumbnailFading.set(false);

    const token = ++this.thumbToken;
    canvas.toBlob(blob => { if (blob) this.sendBlob(blob, token); }, 'image/jpeg', 0.92);
  }

  private startRecording() {
    if (!this.stream) return;
    this.recordedChunks = [];
    this.recordingDuration.set(0);

    const mimeType = this.getSupportedMimeType();
    try {
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    const actualMime = this.mediaRecorder.mimeType || mimeType;
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: actualMime });
      this.recordedChunks = [];
      this.sendVideoBlob(blob);
    };

    try {
      this.mediaRecorder.start();
    } catch {
      this.mediaRecorder = null;
      this.uploadError.set(true);
      setTimeout(() => this.uploadError.set(false), 3000);
      return;
    }
    this.recording.set(true);
    if (navigator.vibrate) navigator.vibrate(15);

    this.durationTimer = setInterval(() => {
      this.recordingDuration.update(n => n + 1);
      if (this.recordingDuration() >= this.maxRecordingSeconds) this.stopRecording();
    }, 1000);
  }

  private stopRecording() {
    clearInterval(this.durationTimer);
    if (this.mediaRecorder && this.recording()) {
      this.mediaRecorder.stop();
      this.recording.set(false);
      if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
    }
  }

  private getSupportedMimeType(): string {
    const types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
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
    if (!file) return;
    if (file.type.startsWith('video/')) this.sendVideoBlob(file);
    else this.sendBlob(file, ++this.thumbToken);
  }

  private sendBlob(blob: Blob, token: number) {
    const name = this.uploaderName;
    this.uploadQueue.update(n => n + 1);
    let compressedBlob: Blob | null = null;

    this.compressImage(blob)
      .then(compressed => {
        compressedBlob = compressed;
        if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline: true });
        const file = new File([compressed], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        return this.eventService.uploadPhoto(this.eventId, file, name || undefined);
      })
      .then(() => this.showThumbnailSuccess(token))
      .catch(async (err) => {
        console.error('[Camera] upload failed:', err?.message ?? err);
        if (this.thumbToken === token) this.thumbnailUploading.set(false);
        if ((!navigator.onLine || err?.offline) && compressedBlob) {
          await this.offlineQueue.enqueue(this.eventId, compressedBlob, name, 'photo');
          this.showThumbnailSuccess(token);
        } else if (this.thumbToken === token) {
          this.uploadError.set(true);
          setTimeout(() => this.uploadError.set(false), 4000);
        }
      })
      .finally(() => this.uploadQueue.update(n => Math.max(0, n - 1)));
  }

  private sendVideoBlob(blob: Blob) {
    const token = ++this.thumbToken;
    const mimeType = blob.type || 'video/webm';
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const name = this.uploaderName;

    this.uploadQueue.update(n => n + 1);
    this.videoUploadProgress.set(0);

    const objectUrl = URL.createObjectURL(blob);
    if (this.thumbnailObjectUrl) URL.revokeObjectURL(this.thumbnailObjectUrl);
    this.thumbnailObjectUrl = objectUrl;
    this.thumbnailUrl.set(objectUrl);
    this.thumbnailIsVideo.set(true);
    this.thumbnailUploading.set(true);
    this.thumbnailSuccess.set(false);
    this.thumbnailFading.set(false);

    if (!navigator.onLine) {
      this.offlineQueue.enqueue(this.eventId, blob, name, 'video').then(() => {
        if (this.thumbToken === token) this.thumbnailUploading.set(false);
        this.showThumbnailSuccess(token);
        this.uploadQueue.update(n => Math.max(0, n - 1));
      });
      return;
    }

    const file = blob instanceof File ? blob as File : new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType });

    this.eventService.uploadVideo(this.eventId, file, name || undefined, (pct) => {
      if (this.thumbToken === token) this.videoUploadProgress.set(pct);
    })
      .then(() => {
        if (this.thumbToken === token) this.thumbnailUploading.set(false);
        this.showThumbnailSuccess(token);
      })
      .catch(async () => {
        if (this.thumbToken === token) this.thumbnailUploading.set(false);
        if (!navigator.onLine) {
          await this.offlineQueue.enqueue(this.eventId, blob, name, 'video');
          this.showThumbnailSuccess(token);
        } else {
          this.uploadError.set(true);
          setTimeout(() => this.uploadError.set(false), 4000);
        }
      })
      .finally(() => {
        this.uploadQueue.update(n => Math.max(0, n - 1));
        if (this.thumbnailObjectUrl) {
          URL.revokeObjectURL(this.thumbnailObjectUrl);
          this.thumbnailObjectUrl = null;
        }
      });
  }

  private showThumbnailSuccess(token: number) {
    if (this.thumbToken !== token) return;
    this.thumbnailSuccess.set(true);
    setTimeout(() => {
      if (this.thumbToken !== token) return;
      this.thumbnailFading.set(true);
      setTimeout(() => {
        if (this.thumbToken !== token) return;
        this.thumbnailUrl.set(null);
        this.thumbnailIsVideo.set(false);
        this.thumbnailSuccess.set(false);
        this.thumbnailFading.set(false);
      }, 300);
    }, 1200);
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

  goBack() { this.router.navigate(['/event', this.eventId, 'gallery']); }

  ngOnDestroy() {
    if (this.mediaRecorder) this.mediaRecorder.onstop = null;
    if (this.recording()) { clearInterval(this.durationTimer); this.mediaRecorder?.stop(); }
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.thumbnailObjectUrl) URL.revokeObjectURL(this.thumbnailObjectUrl);
  }
}

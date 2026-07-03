import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EventService } from '../../services/event.service';
import { AuthService } from '../../services/auth.service';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import jsQR from 'jsqr';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LangSwitcherComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  @ViewChild('scanVideo') scanVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('scanCanvas') scanCanvasRef!: ElementRef<HTMLCanvasElement>;

  code = '';
  username = '';
  loading = signal(false);

  constructor() {
    const lastEventId = localStorage.getItem('lastEventId');
    if (lastEventId && localStorage.getItem(`event_${lastEventId}`)) {
      inject(Router).navigate(['/event', lastEventId, 'gallery']);
    }
  }
  error = signal('');
  showModal = signal(false);
  showScanner = signal(false);
  scanError = signal('');

  private pendingEventId = '';
  private stream: MediaStream | null = null;
  private scanLoop: number | null = null;

  private router = inject(Router);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);

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
      localStorage.setItem(`event_${event.id}`, 'true');
      localStorage.setItem('lastEventId', event.id);
      await this.authService.signInAnonymously();
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
    if (this.username.trim()) localStorage.setItem('username', this.username.trim());
    this.router.navigate(['/event', this.pendingEventId, 'gallery']);
  }

  goToAdmin() {
    this.router.navigate(['/admin/login']);
  }

  async openScanner() {
    this.scanError.set('');
    this.showScanner.set(true);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setTimeout(() => this.startScanLoop(), 100);
    } catch {
      this.scanError.set(this.translate.instant('HOME.SCAN_ERROR_CAMERA'));
    }
  }

  closeScanner() {
    this.stopScanLoop();
    this.showScanner.set(false);
  }

  private startScanLoop() {
    const video = this.scanVideoRef?.nativeElement;
    if (!video || !this.stream) return;
    video.srcObject = this.stream;
    video.play();
    const tick = () => {
      if (!this.showScanner()) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = this.scanCanvasRef.nativeElement;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          this.handleScannedUrl(code.data);
          return;
        }
      }
      this.scanLoop = requestAnimationFrame(tick);
    };
    this.scanLoop = requestAnimationFrame(tick);
  }

  private stopScanLoop() {
    if (this.scanLoop !== null) {
      cancelAnimationFrame(this.scanLoop);
      this.scanLoop = null;
    }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private handleScannedUrl(raw: string) {
    this.stopScanLoop();
    this.showScanner.set(false);
    try {
      const url = new URL(raw);
      this.router.navigateByUrl(url.pathname + url.search);
    } catch {
      this.scanError.set(this.translate.instant('HOME.SCAN_ERROR_INVALID'));
    }
  }
}

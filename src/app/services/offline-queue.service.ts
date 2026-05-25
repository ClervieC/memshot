import { Injectable, signal, inject } from '@angular/core';
import { EventService } from './event.service';

interface QueueItem {
  id: string;
  eventId: string;
  uploaderName: string;
  type: 'photo' | 'video';
  blobData: ArrayBuffer;
  mimeType: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  pendingCount = signal(0);
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'memshot-offline';
  private readonly STORE = 'uploads';
  private eventService = inject(EventService);

  constructor() {
    this.openDb().then(() => {
      this.refreshCount();
      if (navigator.onLine) this.processQueue();
    });
    window.addEventListener('online', () => this.processQueue());
  }

  private openDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.STORE, { keyPath: 'id' });
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  async enqueue(eventId: string, blob: Blob, uploaderName: string, type: 'photo' | 'video'): Promise<void> {
    if (!this.db) return;
    const blobData = await blob.arrayBuffer();
    const item: QueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      eventId, uploaderName, type, blobData,
      mimeType: blob.type || (type === 'video' ? 'video/webm' : 'image/jpeg')
    };
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).add(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.refreshCount();
  }

  private getAll(): Promise<QueueItem[]> {
    if (!this.db) return Promise.resolve([]);
    return new Promise(resolve => {
      const tx = this.db!.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  private remove(id: string): Promise<void> {
    if (!this.db) return Promise.resolve();
    return new Promise(resolve => {
      const tx = this.db!.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).delete(id);
      tx.oncomplete = () => resolve();
    });
  }

  private async refreshCount() {
    const items = await this.getAll();
    this.pendingCount.set(items.length);
  }

  async processQueue(): Promise<void> {
    if (!navigator.onLine || !this.db) return;
    const items = await this.getAll();
    for (const item of items) {
      try {
        const blob = new Blob([item.blobData], { type: item.mimeType });
        const ext = item.type === 'video' ? (item.mimeType.includes('mp4') ? 'mp4' : 'webm') : 'jpg';
        const file = new File([blob], `offline_${item.id}.${ext}`, { type: item.mimeType });
        if (item.type === 'photo') {
          await this.eventService.uploadPhoto(item.eventId, file, item.uploaderName || undefined);
        } else {
          await this.eventService.uploadVideo(item.eventId, file, item.uploaderName || undefined);
        }
        await this.remove(item.id);
        this.pendingCount.update(n => Math.max(0, n - 1));
      } catch {
        break;
      }
    }
  }
}

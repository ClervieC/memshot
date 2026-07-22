import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private bucket = environment.supabase.mediaBucket;

  private buildPath(file: File, folder?: string): string {
    const ext = file.name.split('.').pop() || 'bin';
    const key = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    return folder ? `${folder}/${key}` : key;
  }

  private publicUrl(path: string): string {
    return supabase.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  async uploadImage(file: File, folder?: string): Promise<string> {
    const path = this.buildPath(file, folder);
    const { error } = await supabase.storage.from(this.bucket).upload(path, file, {
      contentType: file.type,
    });
    if (error) throw error;
    return this.publicUrl(path);
  }

  uploadVideo(file: File, folder?: string, onProgress?: (pct: number) => void): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const path = this.buildPath(file, folder);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { reject(new Error('Not authenticated')); return; }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${environment.supabase.url}/storage/v1/object/${this.bucket}/${path}`);
      xhr.setRequestHeader('apikey', environment.supabase.anonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'false');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round(e.loaded / e.total * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(this.publicUrl(path));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.message || 'Video upload failed'));
          } catch {
            reject(new Error('Video upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  }
}

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private workerUrl = environment.r2.workerUrl;
  private secret = environment.r2.uploadSecret;

  async uploadImage(file: File, folder?: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);

    const response = await fetch(this.workerUrl, {
      method: 'POST',
      headers: { 'X-Upload-Secret': this.secret },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Upload failed');
    }

    const { url } = await response.json();
    return url as string;
  }

  uploadVideo(file: File, folder?: string, onProgress?: (pct: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) formData.append('folder', folder);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.workerUrl);
      xhr.setRequestHeader('X-Upload-Secret', this.secret);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round(e.loaded / e.total * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { url } = JSON.parse(xhr.responseText);
            resolve(url);
          } catch {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Video upload failed'));
          } catch {
            reject(new Error('Video upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  }
}

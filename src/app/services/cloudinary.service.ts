import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private cloudName = environment.cloudinary.cloudName;
  private uploadPreset = environment.cloudinary.uploadPreset;

  async uploadImage(file: File, folder?: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    if (folder) formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Upload failed');
    }

    const { secure_url } = await response.json();
    return secure_url as string;
  }

  uploadVideo(file: File, folder?: string, onProgress?: (pct: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      if (folder) formData.append('folder', folder);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round(e.loaded / e.total * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { secure_url } = JSON.parse(xhr.responseText);
            resolve(secure_url);
          } catch {
            reject(new Error('Invalid response'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || 'Video upload failed'));
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

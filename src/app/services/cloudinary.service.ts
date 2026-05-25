import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {

  /**
   * Upload an image to Cloudinary using an unsigned upload preset.
   * No backend required — upload goes directly from the browser.
   *
   * @param file     The image File to upload
   * @param folder   Optional Cloudinary folder (e.g. event ID)
   * @returns        Secure URL of the uploaded image
   */
  async uploadImage(file: File, folder?: string): Promise<string> {
    const { cloudName, uploadPreset } = environment.cloudinary;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    if (folder) {
      formData.append('folder', `memshot/${folder}`);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Cloudinary upload failed');
    }

    const data = await response.json();
    return data.secure_url as string;
  }

  uploadVideo(file: File, folder?: string, onProgress?: (pct: number) => void): Promise<string> {
    const { cloudName, uploadPreset } = environment.cloudinary;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    if (folder) formData.append('folder', `memshot/${folder}`);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round(e.loaded / e.total * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || 'Cloudinary video upload failed'));
          } catch {
            reject(new Error('Cloudinary video upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  }
}

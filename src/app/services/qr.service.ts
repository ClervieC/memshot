import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class QrService {

  /**
   * Génère un QR code via l'API QuickChart (pas de dépendance npm, 100% browser).
   * Retourne une data URL base64 en téléchargeant l'image.
   */
  async generateQR(eventId: string, baseUrl: string, password?: string): Promise<string> {
    const url = this.getEventUrl(eventId, baseUrl, password);
    const apiUrl = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=300&margin=2&dark=0a0a0a&light=ffffff&format=png`;

    const response = await fetch(apiUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  getEventUrl(eventId: string, baseUrl: string, password?: string): string {
    const url = `${baseUrl}/event/${eventId}`;
    return password ? `${url}?code=${encodeURIComponent(password)}` : url;
  }
}

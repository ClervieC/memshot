import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Event, Photo } from '../models/event.model';
import { StorageService } from './storage.service';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class EventService {
  private storage = inject(StorageService);

  private async hashPassword(password: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private mapEvent(row: any): Event {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      password: row.password,
      passwordHash: row.password_hash ?? undefined,
      organizerId: row.organizer_id,
      createdAt: new Date(row.created_at),
      date: new Date(row.date),
      photoCount: row.photo_count,
      coverUrl: row.cover_url ?? undefined,
      closed: row.closed,
    };
  }

  private mapPhoto(row: any): Photo {
    return {
      id: row.id,
      eventId: row.event_id,
      url: row.url,
      type: row.type,
      uploadedAt: new Date(row.uploaded_at),
      uploaderName: row.uploader_name ?? undefined,
    };
  }

  private watchTable<T>(
    table: 'events' | 'photos',
    column: string,
    value: string,
    orderCol: string,
    mapRow: (row: any) => T
  ): Observable<T[]> {
    return new Observable(observer => {
      const fetch = async () => {
        const { data, error } = await supabase
          .from(table).select('*').eq(column, value).order(orderCol, { ascending: false });
        if (!error) observer.next((data ?? []).map(mapRow));
      };
      fetch();
      const channel = supabase
        .channel(`${table}_${column}_${value}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `${column}=eq.${value}` }, fetch)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }

  async createEvent(name: string, description: string, password: string, date: Date): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const passwordHash = await this.hashPassword(password);
    const { data, error } = await supabase.from('events').insert({
      name, description, password, password_hash: passwordHash,
      organizer_id: user.id, date: date.toISOString()
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (error || !data) return null;
    return this.mapEvent(data);
  }

  async verifyEventPassword(eventId: string, password: string): Promise<boolean> {
    const event = await this.getEvent(eventId);
    if (!event) return false;
    if (event.passwordHash) {
      const hash = await this.hashPassword(password);
      return event.passwordHash === hash;
    }
    return event.password === password;
  }

  async findEventByPassword(password: string): Promise<Event | null> {
    const hash = await this.hashPassword(password);
    let { data } = await supabase.from('events').select('*').eq('password_hash', hash).limit(1);
    if (!data?.length) {
      ({ data } = await supabase.from('events').select('*').eq('password', password).limit(1));
    }
    if (!data?.length) return null;
    return this.mapEvent(data[0]);
  }

  getEventPhotos$(eventId: string): Observable<Photo[]> {
    return this.watchTable('photos', 'event_id', eventId, 'uploaded_at', row => this.mapPhoto(row));
  }

  async uploadPhoto(eventId: string, file: File, uploaderName?: string): Promise<string> {
    const url = await this.storage.uploadImage(file, eventId);
    await supabase.from('photos').insert({
      event_id: eventId, url, type: 'photo', uploader_name: uploaderName || 'Anonyme'
    });
    await supabase.rpc('bump_event_photo_count', { p_event_id: eventId, p_delta: 1, p_cover_url: url });
    return url;
  }

  async uploadVideo(eventId: string, file: File, uploaderName?: string, onProgress?: (pct: number) => void): Promise<string> {
    const url = await this.storage.uploadVideo(file, eventId, onProgress);
    await supabase.from('photos').insert({
      event_id: eventId, url, type: 'video', uploader_name: uploaderName || 'Anonyme'
    });
    await supabase.rpc('bump_event_photo_count', { p_event_id: eventId, p_delta: 1, p_cover_url: url });
    return url;
  }

  async setEventClosed(eventId: string, closed: boolean): Promise<void> {
    await supabase.from('events').update({ closed }).eq('id', eventId);
  }

  async setCoverUrl(eventId: string, url: string): Promise<void> {
    await supabase.from('events').update({ cover_url: url }).eq('id', eventId);
  }

  async deletePhoto(eventId: string, photoId: string): Promise<void> {
    const { data: photo } = await supabase.from('photos').select('url').eq('id', photoId).maybeSingle();
    await supabase.from('photos').delete().eq('id', photoId);
    await supabase.rpc('bump_event_photo_count', { p_event_id: eventId, p_delta: -1 });
    if (photo?.url) await this.storage.remove([photo.url]);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const { data: photos } = await supabase.from('photos').select('url').eq('event_id', eventId);
    // photo rows are removed automatically via the events -> photos cascade FK
    await supabase.from('events').delete().eq('id', eventId);
    if (photos?.length) await this.storage.remove(photos.map(p => p.url));
  }

  getOrganizerEvents$(organizerId: string): Observable<Event[]> {
    return this.watchTable('events', 'organizer_id', organizerId, 'created_at', row => this.mapEvent(row));
  }
}

import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, doc, getDoc,
  getDocs, query, where, updateDoc, increment,
  orderBy, collectionData, deleteDoc
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Event, Photo } from '../models/event.model';
import { CloudinaryService } from './cloudinary.service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EventService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private cloudinary = inject(CloudinaryService);

  private async hashPassword(password: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async createEvent(name: string, description: string, password: string, date: Date): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const passwordHash = await this.hashPassword(password);
    const eventRef = await addDoc(collection(this.firestore, 'events'), {
      name, description, password, passwordHash,
      organizerId: user.uid,
      createdAt: new Date(),
      date,
      photoCount: 0
    });
    return eventRef.id;
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const eventDoc = await getDoc(doc(this.firestore, 'events', eventId));
    if (!eventDoc.exists()) return null;
    return this.convertTimestamps({ id: eventDoc.id, ...eventDoc.data() }) as Event;
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

  /** Trouve un événement par son mot de passe — retourne null si introuvable */
  async findEventByPassword(password: string): Promise<Event | null> {
    const hash = await this.hashPassword(password);
    let q = query(collection(this.firestore, 'events'), where('passwordHash', '==', hash));
    let snapshot = await getDocs(q);
    if (snapshot.empty) {
      q = query(collection(this.firestore, 'events'), where('password', '==', password));
      snapshot = await getDocs(q);
    }
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return this.convertTimestamps({ id: d.id, ...d.data() }) as Event;
  }

  getEventPhotos$(eventId: string): Observable<Photo[]> {
    const photosRef = collection(this.firestore, 'events', eventId, 'photos');
    const q = query(photosRef, orderBy('uploadedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Photo[]>;
  }

  async uploadPhoto(eventId: string, file: File, uploaderName?: string): Promise<string> {
    const url = await this.cloudinary.uploadImage(file, eventId);
    await addDoc(collection(this.firestore, 'events', eventId, 'photos'), {
      url,
      uploadedAt: new Date(),
      uploaderName: uploaderName || 'Anonyme',
      eventId
    });
    await updateDoc(doc(this.firestore, 'events', eventId), {
      photoCount: increment(1)
    });
    return url;
  }

  async setEventClosed(eventId: string, closed: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'events', eventId), { closed });
  }

  async deletePhoto(eventId: string, photoId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'events', eventId, 'photos', photoId));
    await updateDoc(doc(this.firestore, 'events', eventId), { photoCount: increment(-1) });
  }

  async deleteEvent(eventId: string): Promise<void> {
    const photosRef = collection(this.firestore, 'events', eventId, 'photos');
    const snapshot = await getDocs(photosRef);
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(this.firestore, 'events', eventId));
  }

  async getOrganizerEvents(organizerId: string): Promise<Event[]> {
    const q = query(
      collection(this.firestore, 'events'),
      where('organizerId', '==', organizerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.convertTimestamps({ id: d.id, ...d.data() }) as Event);
  }

  getOrganizerEvents$(organizerId: string): Observable<Event[]> {
    const q = query(
      collection(this.firestore, 'events'),
      where('organizerId', '==', organizerId),
      orderBy('createdAt', 'desc')
    );
    return new Observable(observer => {
      const unsub = (collectionData(q, { idField: 'id' }) as Observable<Event[]>)
        .subscribe(events => observer.next(events.map(e => this.convertTimestamps(e) as Event)));
      return () => unsub.unsubscribe();
    });
  }

  private convertTimestamps(data: any): any {
    const result = { ...data };
    for (const key of Object.keys(result)) {
      const val = result[key];
      if (val && typeof val.toDate === 'function') {
        result[key] = val.toDate();
      }
    }
    return result;
  }
}

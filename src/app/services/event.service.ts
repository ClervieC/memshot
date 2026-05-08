import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, doc, getDoc,
  getDocs, query, where, updateDoc, increment,
  orderBy, collectionData
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

  async createEvent(name: string, description: string, password: string, date: Date): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const eventRef = await addDoc(collection(this.firestore, 'events'), {
      name, description, password,
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
    return event.password === password;
  }

  /** Trouve un événement par son mot de passe — retourne null si introuvable */
  async findEventByPassword(password: string): Promise<Event | null> {
    const q = query(collection(this.firestore, 'events'), where('password', '==', password));
    const snapshot = await getDocs(q);
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

  async getOrganizerEvents(organizerId: string): Promise<Event[]> {
    const q = query(
      collection(this.firestore, 'events'),
      where('organizerId', '==', organizerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.convertTimestamps({ id: d.id, ...d.data() }) as Event);
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

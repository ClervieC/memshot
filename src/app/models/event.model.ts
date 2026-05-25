export interface Event {
  id: string;
  name: string;
  description?: string;
  password: string;
  passwordHash?: string;
  organizerId: string;
  createdAt: Date;
  date: Date;
  photoCount: number;
  coverUrl?: string;
  closed?: boolean;
}

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  type?: 'photo' | 'video';
  uploadedAt: Date;
  uploaderName?: string;
}

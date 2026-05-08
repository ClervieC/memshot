export interface Event {
  id: string;
  name: string;
  description?: string;
  password: string;
  organizerId: string;
  createdAt: Date;
  date: Date;
  photoCount: number;
  coverUrl?: string;
}

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  uploadedAt: Date;
  uploaderName?: string;
}

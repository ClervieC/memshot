import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface Message {
  id: string;
  event_id: string;
  event_name?: string;
  sender_name: string | null;
  content: string;
  created_at: string;
}

export interface Review {
  id: string;
  event_id: string | null;
  event_name?: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  organizer_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {

  async getSupportMessages(organizerId: string): Promise<SupportMessage[]> {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async sendSupportMessage(organizerId: string, senderId: string, content: string) {
    const { error } = await supabase.from('support_messages').insert({
      organizer_id: organizerId, sender_id: senderId, content
    });
    if (error) throw error;
  }

  async getAllSupportMessages(): Promise<SupportMessage[]> {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  subscribeSupportMessages(organizerId: string, cb: () => void) {
    const channel = organizerId === 'all'
      ? supabase.channel('support_all').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, cb)
      : supabase.channel(`support_${organizerId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `organizer_id=eq.${organizerId}` }, cb);
    return channel.subscribe();
  }

  async sendMessage(eventId: string, senderName: string | null, content: string) {
    const { error } = await supabase.from('messages').insert({
      event_id: eventId, sender_name: senderName || null, content
    });
    if (error) throw error;
  }

  async sendReview(eventId: string | null, rating: number, comment: string | null) {
    const { error } = await supabase.from('reviews').insert({
      event_id: eventId, rating, comment: comment || null
    });
    if (error) throw error;
  }

  async getMessages(): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, events(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((m: any) => ({ ...m, event_name: m.events?.name }));
  }

  async getReviews(): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, events(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => ({ ...r, event_name: r.events?.name }));
  }

  async getAllUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase.rpc('get_all_users');
    if (error) throw error;
    return data || [];
  }
}

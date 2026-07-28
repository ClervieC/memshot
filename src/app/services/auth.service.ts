import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser$: Observable<User | null> = new Observable(observer => {
    supabase.auth.getSession().then(({ data }) => observer.next(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      observer.next(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  });

  private currentUser: User | null = null;

  constructor() {
    supabase.auth.getSession().then(({ data }) => this.currentUser = data.session?.user ?? null);
    supabase.auth.onAuthStateChange((_event, session) => this.currentUser = session?.user ?? null);
  }

  async login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async register(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async logout() {
    await supabase.auth.signOut();
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async signInAnonymously() {
    if (this.currentUser) return;
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error) this.currentUser = data.user;
    } catch { /* anonymous auth not enabled */ }
  }
}

import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = '';
  password = '';
  mode = signal<'login' | 'register'>('login');
  loading = signal(false);
  error = signal('');

  constructor(public router: Router, private authService: AuthService) {}

  async submit() {
    if (!this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      if (this.mode() === 'login') {
        await this.authService.login(this.email, this.password);
      } else {
        await this.authService.register(this.email, this.password);
      }
      this.router.navigate(['/admin/dashboard']);
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential' ? 'Email ou mot de passe incorrect.' :
                  e.code === 'auth/email-already-in-use' ? 'Cet email est déjà utilisé.' :
                  e.code === 'auth/weak-password' ? 'Mot de passe trop faible (6 caractères min).' :
                  'Une erreur est survenue.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}

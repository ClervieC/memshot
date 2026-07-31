import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LangSwitcherComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  mode = signal<'login' | 'register' | 'forgot'>('login');
  loading = signal(false);
  error = signal('');
  resetSent = signal(false);
  registerSuccess = signal(false);
  registeredEmail = signal('');

  router = inject(Router);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);

  ngOnInit() {
    const u = this.authService.getCurrentUser();
    if (u && !u.is_anonymous) this.router.navigate(['/admin/dashboard']);
  }

  async submit() {
    if (this.mode() === 'forgot') {
      await this.submitForgotPassword();
      return;
    }
    if (!this.email || !this.password) {
      this.error.set(this.translate.instant('LOGIN.ERROR_EMPTY'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.mode() === 'login') {
        await this.authService.login(this.email, this.password);
        const dest = this.authService.isSuperAdmin() ? '/admin/superadmin' : '/admin/dashboard';
        this.router.navigate([dest]);
      } else {
        await this.authService.register(this.email, this.password);
        this.registeredEmail.set(this.email);
        this.registerSuccess.set(true);
      }
    } catch (e: any) {
      const msg = e.code === 'invalid_credentials' ? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIAL') :
                  e.code === 'user_already_exists' ? this.translate.instant('LOGIN.ERROR_EMAIL_ALREADY_IN_USE') :
                  e.code === 'weak_password' ? this.translate.instant('LOGIN.ERROR_WEAK_PASSWORD') :
                  this.translate.instant('LOGIN.ERROR_UNKNOWN');
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  showForgotPassword() {
    this.mode.set('forgot');
    this.error.set('');
    this.resetSent.set(false);
  }

  async submitForgotPassword() {
    if (!this.email) {
      this.error.set(this.translate.instant('LOGIN.ERROR_EMPTY'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.resetPassword(this.email);
      this.resetSent.set(true);
    } catch {
      this.error.set(this.translate.instant('LOGIN.ERROR_UNKNOWN'));
    } finally {
      this.loading.set(false);
    }
  }
}

import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LangSwitcherComponent } from "src/app/shared/lang-switcher/lang-switcher.component";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LangSwitcherComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = '';
  password = '';
  mode = signal<'login' | 'register'>('login');
  loading = signal(false);
  error = signal('');

  constructor(public router: Router, private authService: AuthService, private translate: TranslateService) {}

  async submit() {
    if (!this.email || !this.password) {
      this.error.set(this.translate.instant('LOGIN.ERROR_EMPTY'));
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
      const msg = e.code === 'auth/invalid-credential' ? this.translate.instant('LOGIN.ERROR_INVALID_CREDENTIAL') :
                  e.code === 'auth/email-already-in-use' ? this.translate.instant('LOGIN.ERROR_EMAIL_ALREADY_IN_USE') :
                  e.code === 'auth/weak-password' ? this.translate.instant('LOGIN.ERROR_WEAK_PASSWORD') :
                  this.translate.instant('LOGIN.ERROR_UNKNOWN');
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}

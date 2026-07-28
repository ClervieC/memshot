import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth.service';
import { LangSwitcherComponent } from 'src/app/shared/lang-switcher/lang-switcher.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LangSwitcherComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent {
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  constructor(
    private router: Router,
    private authService: AuthService,
    private translate: TranslateService,
  ) {}

  async submit() {
    if (!this.password || !this.confirmPassword) {
      this.error.set(this.translate.instant('RESET_PASSWORD.ERROR_EMPTY'));
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set(this.translate.instant('RESET_PASSWORD.ERROR_MISMATCH'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.updatePassword(this.password);
      this.success.set(true);
    } catch (e: any) {
      const msg = e.code === 'weak_password' ? this.translate.instant('RESET_PASSWORD.ERROR_WEAK_PASSWORD') :
                  e.code === 'session_not_found' || e.code === 'bad_jwt' ? this.translate.instant('RESET_PASSWORD.ERROR_INVALID_LINK') :
                  this.translate.instant('RESET_PASSWORD.ERROR_UNKNOWN');
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  goToLogin() {
    this.router.navigate(['/admin/login']);
  }
}

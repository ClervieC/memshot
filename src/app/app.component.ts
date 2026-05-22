import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmModalComponent } from './shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmModalComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}

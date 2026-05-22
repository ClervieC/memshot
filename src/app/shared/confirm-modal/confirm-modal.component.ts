import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css'
})
export class ConfirmModalComponent {
  confirm = inject(ConfirmService);
}

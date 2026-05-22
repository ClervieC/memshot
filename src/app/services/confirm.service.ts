import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  titleParams?: object;
  message?: string;
  messageParams?: object;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  state = signal<ConfirmState | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      this.state.set({ ...options, resolve });
    });
  }

  accept() {
    this.state()?.resolve(true);
    this.state.set(null);
  }

  cancel() {
    this.state()?.resolve(false);
    this.state.set(null);
  }
}

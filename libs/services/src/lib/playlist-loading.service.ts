import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlaylistLoadingService {
    readonly active = signal(false);
    readonly message = signal('Carregando lista…');
    readonly percent = signal<number | null>(null);
    begin(message = 'Carregando lista…'): void {
        this.message.set(message);
        this.percent.set(null);
        this.active.set(true);
    }
    stage(message: string, percent: number | null = null): void {
        this.message.set(message);
        this.percent.set(percent);
    }
    finish(): void {
        this.active.set(false);
        this.percent.set(null);
    }
}

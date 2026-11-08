import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { WebPlayerViewComponent } from 'shared-portals';
import type { PlaybackPositionData } from '../data-sources/xtream-data-source.interface';
import { XtreamStore } from '../stores/xtream.store';

type FloatingPlayerState = {
    streamUrl: string;
    title: string;
    startTime?: number;
    subtitleUrl?: string | null;
    contentInfo?: Record<string, unknown>;
};

@Component({
    selector: 'app-floating-player',
    standalone: true,
    templateUrl: './floating-player.component.html',
    styleUrl: './floating-player.component.scss',
    imports: [MatButtonModule, MatIcon, MatTooltip, WebPlayerViewComponent],
})
export class FloatingPlayerComponent implements OnInit, OnDestroy {
    private readonly xtreamStore = inject(XtreamStore);
    readonly state = signal<FloatingPlayerState | null>(null);
    readonly alwaysOnTop = signal(false);
    private unsubscribeSource?: () => void;
    private lastPositionSeconds = 0;
    private lastSaveTime = 0;

    ngOnInit(): void {
        void this.refreshSession();
        this.unsubscribeSource = window.electron?.onAuroraPiPSourceChanged?.(
            () => void this.refreshSession()
        );
    }

    ngOnDestroy(): void {
        this.unsubscribeSource?.();
    }

    private async refreshSession(): Promise<void> {
        const state = await window.electron?.getAuroraPiPState?.();
        if (state) {
            this.lastPositionSeconds = state.startTime ?? 0;
            this.lastSaveTime = 0;
            this.state.set(state);
        }
    }

    async toggleAlwaysOnTop(): Promise<void> {
        const enabled = await window.electron?.setAuroraPiPAlwaysOnTop?.(
            !this.alwaysOnTop()
        );
        this.alwaysOnTop.set(enabled === true);
    }

    async returnToApp(): Promise<void> {
        await window.electron?.returnFromAuroraPiP?.(
            this.lastPositionSeconds
        );
    }

    handleTimeUpdate(event: { currentTime: number; duration: number }): void {
        if (Number.isFinite(event.currentTime) && event.currentTime >= 0) {
            this.lastPositionSeconds = event.currentTime;
        }
        const data = this.state()?.contentInfo;
        if (
            !data ||
            typeof data['playlistId'] !== 'string' ||
            typeof data['contentXtreamId'] !== 'number' ||
            (data['contentType'] !== 'vod' && data['contentType'] !== 'episode')
        ) return;
        const now = Date.now();
        if (now - this.lastSaveTime < 15000) return;
        this.lastSaveTime = now;
        void this.xtreamStore.savePosition(data['playlistId'], {
            ...(data as unknown as PlaybackPositionData),
            positionSeconds: Math.floor(this.lastPositionSeconds),
            durationSeconds: Number.isFinite(event.duration)
                ? Math.floor(event.duration)
                : 0,
        });
    }
}

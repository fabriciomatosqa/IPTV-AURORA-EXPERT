import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { WebPlayerViewComponent } from 'shared-portals';
import { XtreamStore } from '../stores/xtream.store';

export interface PlayerDialogData {
    streamUrl: string;
    title: string;
    contentInfo?: any;
    startTime?: number;
    subtitleUrl?: string;
    streamHeaders?: {
        userAgent?: string;
        referrer?: string;
        origin?: string;
    };
}

@Component({
    templateUrl: './player-dialog.component.html',
    imports: [
        MatIconButton,
        MatDialogModule,
        MatIcon,
        MatTooltip,
        WebPlayerViewComponent,
    ],
    styleUrl: './player-dialog.component.scss',
    encapsulation: ViewEncapsulation.None,
})
export class PlayerDialogComponent {
    readonly data = inject<PlayerDialogData>(MAT_DIALOG_DATA);
    private snackBar = inject(MatSnackBar);
    private readonly xtreamStore = inject(XtreamStore);
    private readonly dialogRef = inject(
        MatDialogRef<PlayerDialogComponent>
    );

    readonly title: string;
    readonly streamUrl: string;
    readonly isFullscreen = signal(false);
    readonly isOpeningPiP = signal(false);
    readonly canUseNativePiP = !!window.electron?.openAuroraPiP;
    private lastPositionSeconds: number;

    private lastSaveTime = 0;
    private previousSize: {
        width?: string;
        height?: string;
        maxWidth?: string;
        maxHeight?: string;
    } | null = null;

    constructor() {
        this.streamUrl = this.data.streamUrl;
        this.title = this.data.title;
        this.lastPositionSeconds = this.data.startTime ?? 0;
    }

    async toggleDialogFullscreen(): Promise<void> {
        // The player already fills the app. This additionally makes the
        // Electron application occupy the entire monitor when requested.
        try {
            const next = await window.electron?.toggleFullScreen?.();
            if (typeof next === 'boolean') {
                this.isFullscreen.set(next);
            } else {
                const element = document.querySelector('.aurora-player-dialog');
                if (!document.fullscreenElement) {
                    await element?.requestFullscreen?.();
                    this.isFullscreen.set(!!document.fullscreenElement);
                } else {
                    await document.exitFullscreen();
                    this.isFullscreen.set(false);
                }
            }
        } catch {
            this.snackBar.open('Não foi possível alternar a tela cheia.', 'Fechar', {
                duration: 3500,
            });
        }
    }

    async openPictureInPicture(): Promise<void> {
        if (this.isOpeningPiP() || !this.canUseNativePiP) return;
        this.isOpeningPiP.set(true);
        try {
            const opened = await window.electron.openAuroraPiP?.({
                streamUrl: this.streamUrl,
                title: this.title,
                startTime: this.lastPositionSeconds,
                subtitleUrl: this.data.subtitleUrl,
                contentInfo: this.data.contentInfo,
            });
            if (opened) {
                // Destroy the in-app player so the same video does not play
                // twice. The native PiP owns playback until Return is clicked.
                this.dialogRef.close();
                return;
            }
            this.snackBar.open('Não foi possível abrir o Picture in Picture.', 'Fechar', {
                duration: 4500,
            });
        } catch {
            this.snackBar.open('Não foi possível abrir o Picture in Picture.', 'Fechar', {
                duration: 4500,
            });
        } finally {
            this.isOpeningPiP.set(false);
        }
    }

    handleTimeUpdate(event: { currentTime: number; duration: number }) {
        if (Number.isFinite(event.currentTime) && event.currentTime >= 0) {
            this.lastPositionSeconds = event.currentTime;
        }
        if (!this.data.contentInfo) return;

        const now = Date.now();
        // Save every 15 seconds
        if (now - this.lastSaveTime > 15000) {
            this.lastSaveTime = now;
            this.xtreamStore.savePosition(this.data.contentInfo.playlistId, {
                ...this.data.contentInfo,
                positionSeconds: Math.floor(event.currentTime),
                durationSeconds: Math.floor(event.duration),
            });
        }
    }

}

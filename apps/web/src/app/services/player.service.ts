import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DataService } from 'services';
import {
    OPEN_MPV_PLAYER,
    OPEN_VLC_PLAYER,
    VideoPlayer,
} from 'shared-interfaces';
import { ExternalPlayerInfoDialogComponent } from '../shared/components/external-player-info-dialog/external-player-info-dialog.component';
import {
    PlayerDialogComponent,
    PlayerDialogData,
} from '../xtream-tauri/player-dialog/player-dialog.component';
import { SettingsStore } from './settings-store.service';

@Injectable({
    providedIn: 'root',
})
export class PlayerService {
    private dialog = inject(MatDialog);
    private dataService = inject(DataService);
    private settingsStore = inject(SettingsStore);

    constructor() {
        // A native PiP can return playback to the main application without
        // losing the selected content or its current position.
        window.electron?.onAuroraPiPReturn?.((data) => {
            this.openEmbeddedPlayer(data);
        });
    }

    private openEmbeddedPlayer(data: PlayerDialogData): void {
        this.dialog.open<PlayerDialogComponent, PlayerDialogData>(
            PlayerDialogComponent,
            {
                data,
                width: '100vw',
                height: '100vh',
                maxWidth: '100vw',
                maxHeight: '100vh',
                panelClass: 'aurora-player-dialog',
                autoFocus: false,
                restoreFocus: true,
            }
        );
    }

    private getPlayableUrlForBrowser(
        streamUrl: string,
        userAgent?: string,
        referer?: string,
        origin?: string
    ): string {
        if (
            window.electron ||
            streamUrl.includes('/stream?url=') ||
            !/^https?:\/\//i.test(streamUrl)
        ) {
            return streamUrl;
        }

        const params = new URLSearchParams({ url: streamUrl });
        if (userAgent) {
            params.set('ua', userAgent);
        }
        if (referer) {
            params.set('ref', referer);
        }
        if (origin) {
            params.set('org', origin);
        }

        return `http://localhost:3000/stream?${params.toString()}`;
    }

    openPlayer(
        streamUrl: string,
        title: string,
        thumbnail?: string,
        hideExternalInfoDialog = true,
        isLiveContent = false,
        userAgent?: string,
        referer?: string,
        origin?: string,
        contentInfo?: any,
        startTime?: number,
        subtitleUrl?: string | null
    ) {
        const player = this.settingsStore.player() ?? VideoPlayer.VideoJs;
        const playableStreamUrl = this.getPlayableUrlForBrowser(
            streamUrl,
            userAgent,
            referer,
            origin
        );

        if (player === VideoPlayer.MPV) {
            if (!hideExternalInfoDialog) {
                this.dialog.open(ExternalPlayerInfoDialogComponent);
            }
            this.dataService.sendIpcEvent(OPEN_MPV_PLAYER, {
                url: streamUrl,
                title,
                thumbnail,
                'user-agent': userAgent,
                referer: referer,
                origin: origin,
                contentInfo,
                startTime,
            });
        } else if (player === VideoPlayer.VLC) {
            if (!hideExternalInfoDialog) {
                this.dialog.open(ExternalPlayerInfoDialogComponent);
            }
            this.dataService.sendIpcEvent(OPEN_VLC_PLAYER, {
                url: streamUrl,
                title,
                thumbnail,
                'user-agent': userAgent,
                referer: referer,
                origin: origin,
                contentInfo,
                startTime,
            });
        } else {
            this.openEmbeddedPlayer({
                streamUrl: playableStreamUrl,
                title,
                contentInfo,
                startTime,
                subtitleUrl: subtitleUrl ?? undefined,
            });
        }
    }
}

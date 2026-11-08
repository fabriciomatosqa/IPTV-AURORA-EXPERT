import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PlaylistActions } from 'm3u-state';
import {
    createPlaylistObject,
    getFilenameFromUrl,
    getPlaylistImportMessage,
    parsePlaylistContent,
} from 'm3u-utils';
import { DataService, PlaylistLoadingService } from 'services';
import { PLAYLIST_PARSE_BY_URL } from 'shared-interfaces';
import { FileUploadComponent } from '../../../home/file-upload/file-upload.component';
import { StalkerPortalImportComponent } from '../../../home/stalker-portal-import/stalker-portal-import.component';
import { TextImportComponent } from '../../../home/text-import/text-import.component';
import { UrlUploadComponent } from '../../../home/url-upload/url-upload.component';
import { XtreamCodeImportComponent } from '../../../home/xtream-code-import/xtream-code-import.component';

export type PlaylistType = 'xtream' | 'url' | 'text' | 'file' | 'stalker';

@Component({
    imports: [
        FileUploadComponent,
        MatButtonModule,
        MatDialogModule,
        StalkerPortalImportComponent,
        TextImportComponent,
        TranslateModule,
        UrlUploadComponent,
        XtreamCodeImportComponent,
    ],
    selector: 'app-add-playlist',
    templateUrl: './add-playlist-dialog.component.html',
})
export class AddPlaylistDialogComponent {
    private dataService = inject(DataService);
    private readonly playlistLoading = inject(PlaylistLoadingService);
    private dialogRef = inject(MatDialogRef<AddPlaylistDialogComponent>);
    private store = inject(Store);
    private snackBar = inject(MatSnackBar);
    private translateService = inject(TranslateService);
    readonly data = inject<{ type: PlaylistType }>(MAT_DIALOG_DATA);

    readonly playlistType!: PlaylistType;

    constructor() {
        this.playlistType = this.data.type;
    }

    /**
     * Parse and store uploaded playlist
     * @param payload
     */
    handlePlaylist(payload: { uploadEvent: Event; file: File }): void {
        const playlist = (payload.uploadEvent.target as FileReader)
            .result as string;

        this.importContent(
            playlist,
            payload.file.name,
            'FILE',
            (payload.file as File & { path?: string }).path
        );
    }

    rejectFile(filename: string): void {
        this.snackBar.open(
            this.translateService.instant('HOME.FILE_UPLOAD.REJECTED', {
                filename,
            })
        );
    }

    /**
     * Sends url of the playlist to the renderer process
     * @param playlistUrl url of the added playlist
     */
    sendPlaylistsUrl(playlistUrl: string): void {
        this.dataService.sendIpcEvent(PLAYLIST_PARSE_BY_URL, {
            title: getFilenameFromUrl(playlistUrl),
            url: playlistUrl,
        });
        this.closeDialog();
    }

    /**
     * Sends IPC event to the renderer process to parse playlist
     * @param text playlist as string
     */
    uploadAsText(playlist: string): void {
        this.importContent(
            playlist,
            this.translateService.instant('HOME.IMPORTED_AS_TEXT'),
            'TEXT'
        );
    }

    private async importContent(
        content: string,
        title: string,
        type: 'FILE' | 'TEXT',
        path?: string
    ): Promise<void> {
        this.playlistLoading.begin('Lendo conteúdos da lista…');
        await new Promise((resolve) => setTimeout(resolve, 0));
        try {
            const playlist = createPlaylistObject(
                title,
                parsePlaylistContent(content),
                path,
                type
            );
            this.store.dispatch(PlaylistActions.addPlaylist({ playlist }));
            this.playlistLoading.stage('Salvando lista…');
            this.closeDialog();
        } catch (error) {
            this.playlistLoading.finish();
            this.snackBar.open(getPlaylistImportMessage(error), 'Fechar', {
                duration: 9000,
            });
        }
    }

    closeDialog() {
        this.dialogRef.close();
    }
}

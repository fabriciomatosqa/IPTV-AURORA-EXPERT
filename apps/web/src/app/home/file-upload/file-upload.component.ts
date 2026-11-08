import { Component, EventEmitter, inject, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistActions } from 'm3u-state';
import { getPlaylistImportMessage } from 'm3u-utils';
import { DragDropFileUploadDirective } from './drag-drop-file-upload.directive';

@Component({
    imports: [DragDropFileUploadDirective, MatIconModule, TranslatePipe],
    selector: 'app-file-upload',
    templateUrl: './file-upload.component.html',
    styleUrls: ['./file-upload.component.scss'],
})
export class FileUploadComponent {
    @Output() fileSelected = new EventEmitter<{
        uploadEvent: Event;
        file: File;
    }>();
    @Output() fileRejected = new EventEmitter<string>();
    @Output() addClicked = new EventEmitter<void>();
    @Output() closeDialog = new EventEmitter<void>();

    private readonly store = inject(Store);
    private readonly snackBar = inject(MatSnackBar);
    importing = false;

    private isDesktop = !!window.electron;

    allowedContentTypes = [
        'application/mpegurl',
        'application/x-mpegurl',
        'application/octet-stream',
        'application/vnd.apple.mpegurl',
        'application/vnd.apple.mpegurl.audio',
        'audio/x-mpegurl',
        'audio/mpegurl',
        'text/plain',
    ];

    async openDialog(fileField: HTMLInputElement) {
        if (this.importing) return;
        if (this.isDesktop) {
            this.importing = true;
            try {
                const playlist = await window.electron.openPlaylistFromFile();
                if (playlist) {
                    this.store.dispatch(
                        PlaylistActions.addPlaylist({ playlist })
                    );
                    this.closeDialog.emit();
                }
            } catch (error) {
                this.snackBar.open(getPlaylistImportMessage(error), 'Fechar', {
                    duration: 9000,
                });
            } finally {
                this.importing = false;
            }
        } else {
            fileField.click();
        }
    }

    upload(fileList: FileList) {
        if (!fileList?.length || this.importing) return;
        if (
            !/\.(m3u8?|txt)$/i.test(fileList[0].name) &&
            !this.allowedContentTypes.includes(fileList[0].type)
        ) {
            this.fileRejected.emit(fileList[0].name);
            return;
        }
        const fileReader = new FileReader();
        fileReader.onerror = () =>
            this.snackBar.open(
                'Não foi possível ler o arquivo da lista IPTV.',
                'Fechar',
                { duration: 9000 }
            );
        fileReader.onload = (uploadEvent) =>
            this.fileSelected.emit({
                uploadEvent,
                file: fileList[0],
            });
        fileReader.readAsText(fileList[0]);
        this.addClicked.emit();
    }
}

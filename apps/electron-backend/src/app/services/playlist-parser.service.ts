import { app } from 'electron';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { ParsedPlaylist } from 'shared-interfaces';
import {
    playlistImportError,
    playlistImportMessages,
    PlaylistImportFailure,
} from 'm3u-utils';

export function parsePlaylistInWorker(
    content: string,
    sourceUrl?: string
): Promise<ParsedPlaylist> {
    return new Promise((resolve, reject) => {
        const file = app.isPackaged
            ? join(
                  process.resourcesPath,
                  'workers',
                  'playlist-parser.worker.js'
              )
            : join(__dirname, 'workers', 'playlist-parser.worker.js');
        const worker = new Worker(file, { workerData: { content, sourceUrl } });
        let settled = false;
        const finish = (error?: Error, playlist?: ParsedPlaylist) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            void worker.terminate();
            if (error) reject(error);
            else resolve(playlist!);
        };
        const timeout = setTimeout(
            () => finish(playlistImportError('FORMAT')),
            120000
        );
        worker.once(
            'message',
            (result: { playlist?: ParsedPlaylist; error?: string }) => {
                if (result.playlist) finish(undefined, result.playlist);
                else
                    finish(
                        playlistImportError(
                            result.error &&
                                Object.prototype.hasOwnProperty.call(
                                    playlistImportMessages,
                                    result.error
                                )
                                ? (result.error as PlaylistImportFailure)
                                : 'FORMAT'
                        )
                    );
            }
        );
        worker.once('error', () => finish(playlistImportError('FORMAT')));
        worker.once('exit', () => {
            if (!settled) finish(playlistImportError('FORMAT'));
        });
    });
}

import { parentPort, workerData } from 'node:worker_threads';
import { parsePlaylistContent } from 'm3u-utils';

try {
    const playlist = parsePlaylistContent(
        workerData.content,
        workerData.sourceUrl
    );
    playlist.header.raw = '';
    for (const item of playlist.items) item.raw = '';
    parentPort?.postMessage({ playlist });
} catch (error) {
    const marker =
        error instanceof Error
            ? /\[AURORA_IPTV_([A-Z_]+)\]/.exec(error.message)?.[1]
            : undefined;
    parentPort?.postMessage({ error: marker || 'FORMAT' });
}

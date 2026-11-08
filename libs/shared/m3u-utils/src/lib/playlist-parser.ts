import { parse } from 'iptv-playlist-parser';
import { ParsedPlaylist } from 'shared-interfaces';

export const playlistImportMessages = {
    INVALID_URL: 'Endereço inválido: informe uma URL HTTP ou HTTPS.',
    AUTH: 'Autenticação recusada (HTTP 401/403). Confira sua conta com o provedor.',
    NOT_FOUND: 'A lista não foi encontrada no servidor (HTTP 404).',
    HTTP: 'O servidor recusou o download da lista IPTV.',
    DNS: 'Não foi possível localizar o servidor da lista (DNS).',
    TIMEOUT: 'Tempo esgotado ao carregar a lista IPTV.',
    CONNECTION: 'Não foi possível conectar ao servidor da lista IPTV.',
    FILE: 'Não foi possível ler o arquivo da lista IPTV.',
    FORMAT: 'O conteúdo não é uma lista M3U válida.',
    EMPTY: 'Catálogo vazio: a lista M3U não contém canais ou conteúdos.',
    HLS: 'O conteúdo é um manifesto de vídeo HLS, não um catálogo IPTV. Importe uma lista M3U com o endereço desse vídeo.',
    STREAM_URL:
        'A lista contém um endereço de reprodução inválido ou relativo sem uma URL de origem.',
} as const;

export type PlaylistImportFailure = keyof typeof playlistImportMessages;

/** Only these markers cross IPC; never display provider bodies, paths or URLs. */
export function playlistImportError(code: PlaylistImportFailure): Error {
    return new Error(`[AURORA_IPTV_${code}] ${playlistImportMessages[code]}`);
}

export function getPlaylistImportMessage(error: unknown): string {
    const detail = error instanceof Error ? error.message : '';
    const code = /\[AURORA_IPTV_([A-Z_]+)\]/.exec(detail)?.[1];
    return code &&
        Object.prototype.hasOwnProperty.call(playlistImportMessages, code)
        ? playlistImportMessages[code as PlaylistImportFailure]
        : 'Não foi possível importar a lista IPTV. Confira a origem e tente novamente.';
}

/** Shared validation for URL, file and pasted M3U/M3U Plus catalogs. */
export function parsePlaylistContent(
    content: string,
    sourceUrl?: string
): ParsedPlaylist {
    const normalized =
        typeof content === 'string' ? content.replace(/^[\s\uFEFF]+/, '') : '';
    if (!/^#EXTM3U(?:\s|$)/.test(normalized)) {
        throw playlistImportError('FORMAT');
    }
    // HLS segments are not channels, even when the manifest uses EXTINF.
    if (
        /^#EXT-X-(?:TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE|MAP|MEDIA):/m.test(
            normalized
        )
    ) {
        throw playlistImportError('HLS');
    }
    let playlist: ParsedPlaylist;
    try {
        playlist = parse(normalized);
    } catch {
        throw playlistImportError('FORMAT');
    }
    if (!playlist.items?.length) throw playlistImportError('EMPTY');
    for (const item of playlist.items) {
        try {
            const url = sourceUrl
                ? new URL(item.url, sourceUrl)
                : new URL(item.url);
            if (
                !['http:', 'https:', 'rtsp:', 'rtmp:', 'udp:', 'rtp:'].includes(
                    url.protocol
                )
            ) {
                throw new Error();
            }
            item.url = url.toString();
        } catch {
            throw playlistImportError('STREAM_URL');
        }
    }
    return playlist;
}

import {
    getPlaylistImportMessage,
    parsePlaylistContent,
    playlistImportError,
} from './playlist-parser';

describe('M3U import validation', () => {
    const catalog =
        '#EXTM3U x-tvg-url="https://example.test/epg.xml"\n#EXTINF:-1 tvg-id="demo" tvg-logo="https://example.test/logo.png" group-title="Notícias",Canal de teste\nhttps://example.test/live/demo.ts\n';

    it('preserves M3U Plus categories, logos, EPG and MPEG-TS URLs with BOM and whitespace', () => {
        const parsed = parsePlaylistContent('\uFEFF \r\n' + catalog);
        expect(parsed.items).toHaveLength(1);
        expect(parsed.items[0].group.title).toBe('Notícias');
        expect(parsed.items[0].tvg.id).toBe('demo');
        expect(parsed.items[0].tvg.logo).toBe('https://example.test/logo.png');
        expect(parsed.header.attrs['x-tvg-url']).toBe(
            'https://example.test/epg.xml'
        );
        expect(parsed.items[0].url).toBe('https://example.test/live/demo.ts');
    });

    it('resolves relative channel addresses against the final catalog URL', () => {
        expect(
            parsePlaylistContent(
                catalog.replace(
                    'https://example.test/live/demo.ts',
                    '../live/demo.ts'
                ),
                'https://example.test/lists/catalog.m3u8'
            ).items[0].url
        ).toBe('https://example.test/live/demo.ts');
    });

    it.each([
        '',
        '<html>Login secret</html>',
        '{"username":"secret"}',
        '#EXTM3UBROKEN\n',
    ])(
        'rejects non-M3U responses without reflecting their contents',
        (content) => {
            expect(() => parsePlaylistContent(content)).toThrow(
                '[AURORA_IPTV_FORMAT]'
            );
        }
    );

    it('reports an empty catalog separately', () => {
        expect(() => parsePlaylistContent('#EXTM3U\n')).toThrow(
            '[AURORA_IPTV_EMPTY]'
        );
    });

    it('does not import HLS media segments as television channels', () => {
        expect(() =>
            parsePlaylistContent(
                '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nhttps://example.test/segment.ts'
            )
        ).toThrow('[AURORA_IPTV_HLS]');
    });

    it.each(['javascript:alert(1)', '../relative.ts'])(
        'rejects unusable stream addresses',
        (url) => {
            expect(() =>
                parsePlaylistContent(
                    catalog.replace('https://example.test/live/demo.ts', url)
                )
            ).toThrow('[AURORA_IPTV_STREAM_URL]');
        }
    );

    it('maps IPC errors to safe messages and does not echo arbitrary errors', () => {
        expect(
            getPlaylistImportMessage(
                new Error(
                    'Error invoking remote method: ' +
                        playlistImportError('EMPTY').message
                )
            )
        ).toContain('Catálogo vazio');
        expect(
            getPlaylistImportMessage(
                new Error('http://secret-user:secret-password@example.test')
            )
        ).not.toContain('secret');
        expect(getPlaylistImportMessage(playlistImportError('AUTH'))).toContain(
            'Autenticação'
        );
    });
});

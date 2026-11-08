import { getFilenameFromUrl } from './playlist.utils';

describe('getFilenameFromUrl', () => {
    it('does not expose account credentials from M3U Plus URLs', () => {
        const name = getFilenameFromUrl(
            'http://example.test/get.php?username=test-user&password=test-secret&type=m3u_plus&output=mpegts'
        );
        expect(name).toBe('Lista IPTV (example.test)');
        expect(name).not.toContain('test-secret');
        expect(name).not.toContain('test-user');
    });

    it('keeps ordinary file-based playlist names without query strings', () => {
        expect(getFilenameFromUrl('https://example.test/my-list.m3u?token=secret'))
            .toBe('my-list.m3u');
    });

    it('returns a safe default when the source URL is empty', () => {
        expect(getFilenameFromUrl('')).toBe('Untitled playlist');
    });
});

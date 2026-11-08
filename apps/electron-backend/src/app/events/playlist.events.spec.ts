import axios from 'axios';
import { dialog, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import './playlist.events';
jest.mock('../services/playlist-parser.service', () => ({
    parsePlaylistInWorker: async (content: string, sourceUrl?: string) =>
        require('m3u-utils').parsePlaylistContent(content, sourceUrl),
}));

jest.mock('electron', () => ({
    ipcMain: { handle: jest.fn() },
    dialog: { showOpenDialog: jest.fn() },
}));
jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        isAxiosError: (error: any) => error?.isAxiosError === true,
    },
}));
jest.mock('node:fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
}));

const handlers = new Map(
    (ipcMain.handle as jest.Mock).mock.calls.map(([name, handler]) => [
        name,
        handler,
    ])
);
const invoke = (name: string, ...args: unknown[]) =>
    handlers.get(name)({}, ...args);
const catalog =
    '#EXTM3U\n#EXTINF:-1 group-title="Teste",Canal sintético\nhttps://example.test/live/demo.ts\n';

describe('desktop playlist import boundary', () => {
    beforeEach(() => jest.clearAllMocks());

    it('uses the account API when get.php exposes only the live playlist', async () => {
        (axios.get as jest.Mock).mockResolvedValue({
            data: { user_info: { auth: 1, status: 'Active' } },
        });
        const result = await invoke(
            'fetch-playlist-by-url',
            'https://example.test/provider/get.php?username=synthetic&password=synthetic'
        );
        expect(result.serverUrl).toBe('https://example.test/provider');
        expect(result.username).toBe('synthetic');
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect((axios.get as jest.Mock).mock.calls[0][0]).toBe(
            'https://example.test/provider/player_api.php'
        );
    });

    it('imports M3U Plus with MPEG-TS and retains the provider query privately', async () => {
        (axios.get as jest.Mock).mockResolvedValue({ data: catalog });
        const url =
            'https://example.test/get.php?username=synthetic&password=synthetic&type=m3u_plus&output=mpegts';
        const result = await invoke('fetch-playlist-by-url', url);
        expect(result.count).toBe(1);
        expect(result.title).toBe('Lista IPTV (example.test)');
        expect(result.url).toBe(url);
        expect(result.playlist.items[0].group.title).toBe('Teste');
    });

    it('rejects malformed URLs before making a network request', async () => {
        await expect(
            invoke('fetch-playlist-by-url', 'https://')
        ).rejects.toThrow('[AURORA_IPTV_INVALID_URL]');
        expect(axios.get).not.toHaveBeenCalled();
    });

    it.each([
        [{ response: { status: 401 } }, 'AUTH'],
        [{ response: { status: 403 } }, 'AUTH'],
        [{ response: { status: 404 } }, 'NOT_FOUND'],
        [{ response: { status: 503 } }, 'HTTP'],
        [{ code: 'ENOTFOUND' }, 'DNS'],
        [{ code: 'EAI_AGAIN' }, 'DNS'],
        [{ code: 'ETIMEDOUT' }, 'TIMEOUT'],
        [{ code: 'ECONNRESET' }, 'CONNECTION'],
    ])(
        'classifies transport failures without exposing their raw details',
        async (error, code) => {
            (axios.get as jest.Mock).mockRejectedValue({
                ...error,
                isAxiosError: true,
                message: 'synthetic-secret',
            });
            await expect(
                invoke('fetch-playlist-by-url', 'https://example.test/list')
            ).rejects.toThrow(`[AURORA_IPTV_${code}]`);
        }
    );

    it.each([
        ['<html>Login</html>', 'FORMAT'],
        ['#EXTM3U\n', 'EMPTY'],
    ])('validates successful HTTP responses', async (body, code) => {
        (axios.get as jest.Mock).mockResolvedValue({ data: body });
        await expect(
            invoke('fetch-playlist-by-url', 'https://example.test/list')
        ).rejects.toThrow(`[AURORA_IPTV_${code}]`);
    });

    it('uses the redirect destination to resolve relative streams', async () => {
        (axios.get as jest.Mock).mockResolvedValue({
            data: catalog.replace(
                'https://example.test/live/demo.ts',
                '../live/demo.ts'
            ),
            request: {
                res: {
                    responseUrl: 'https://cdn.example.test/lists/catalog.m3u',
                },
            },
        });
        const result = await invoke(
            'fetch-playlist-by-url',
            'https://example.test/list'
        );
        expect(result.playlist.items[0].url).toBe(
            'https://cdn.example.test/live/demo.ts'
        );
    });

    it('validates local files and reports read failures safely', async () => {
        (readFile as jest.Mock).mockResolvedValue('\uFEFF' + catalog);
        expect(
            (
                await invoke(
                    'update-playlist-from-file-path',
                    'synthetic.m3u8',
                    'Demo'
                )
            ).count
        ).toBe(1);
        (readFile as jest.Mock).mockResolvedValue('#EXTM3U\n');
        await expect(
            invoke('update-playlist-from-file-path', 'synthetic.m3u', 'Demo')
        ).rejects.toThrow('[AURORA_IPTV_EMPTY]');
        (readFile as jest.Mock).mockRejectedValue(new Error('private-path'));
        await expect(
            invoke('update-playlist-from-file-path', 'synthetic.m3u', 'Demo')
        ).rejects.toThrow('[AURORA_IPTV_FILE]');
    });

    it('leaves cancellation distinct from failed import', async () => {
        (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
            canceled: true,
            filePaths: [],
        });
        expect(await invoke('open-playlist-from-file')).toBeNull();
        expect(readFile).not.toHaveBeenCalled();
    });
});

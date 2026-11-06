import {
    _electron as electron,
    ElectronApplication,
    expect,
    Page,
    test,
} from '@playwright/test';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    appendFileSync,
} from 'fs';
import { spawnSync } from 'child_process';
import { createServer, Server } from 'http';
import { join, resolve } from 'path';

/**
 * Smoke test for the Electron application.
 * Verifies that the app starts correctly and renders the main window.
 */

let electronApp: ElectronApplication;
let mainWindow: Page;
let fixtureServer: Server;
let fixtureUrl: string;
let profileRoot: string;
const mediaRequests: string[] = [];

// Workspace root (where nx.json is located)
const workspaceRoot = resolve(__dirname, '../../..');

// Path to the packaged Electron app main.js file
const electronMainPath = join(
    workspaceRoot,
    'dist/apps/electron-backend/main.js'
);

// Path for screenshots
const screenshotDir = join(
    workspaceRoot,
    'dist/test-results/electron-backend-e2e'
);

// Ensure screenshot directory exists
if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
}

/**
 * Helper to find the main application window (not DevTools)
 */
async function findMainWindow(app: ElectronApplication): Promise<Page> {
    // Wait for windows to be available
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const windows = app.windows();
    console.log(`Found ${windows.length} window(s)`);

    for (const window of windows) {
        const title = await window.title();
        console.log(`Window title: "${title}"`);
        // Skip DevTools windows
        if (!title.includes('DevTools')) {
            return window;
        }
    }

    // If no non-DevTools window found, wait for one
    console.log('Waiting for main window...');
    return await app.firstWindow();
}

test.describe('Electron App Smoke Test', () => {
    test.beforeAll(async () => {
        profileRoot = mkdtempSync(join(process.env.AURORA_E2E_PROFILE_BASE || screenshotDir, 'aurora-profile-'));
        const videoFile = join(profileRoot, 'fixture.mp4');
        const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
        const generated = spawnSync(
            ffmpeg,
            [
                '-hide_banner',
                '-loglevel',
                'error',
                '-f',
                'lavfi',
                '-i',
                'color=c=0x102333:s=320x180:r=24',
                '-f',
                'lavfi',
                '-i',
                'sine=frequency=440:sample_rate=44100',
                '-t',
                '12',
                '-c:v',
                'libx264',
                '-pix_fmt',
                'yuv420p',
                '-c:a',
                'aac',
                '-movflags',
                '+faststart',
                videoFile,
            ],
            { windowsHide: true }
        );
        expect(generated.status, generated.stderr?.toString()).toBe(0);
        const hlsFile = join(profileRoot, 'fixture.m3u8');
        const hlsGenerated = spawnSync(
            ffmpeg,
            [
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                videoFile,
                '-c',
                'copy',
                '-hls_time',
                '2',
                '-hls_list_size',
                '0',
                hlsFile,
            ],
            { windowsHide: true }
        );
        expect(hlsGenerated.status, hlsGenerated.stderr?.toString()).toBe(0);
        const xmlDate = (date: Date) =>
            date.toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000';
        const epg = `<?xml version="1.0"?><tv><channel id="aurora.demo"><display-name>Aurora Demo</display-name></channel><programme start="${xmlDate(new Date(Date.now() - 3600000))}" stop="${xmlDate(new Date(Date.now() + 3600000))}" channel="aurora.demo"><title>Programa ficticio Aurora</title><desc>Fixture local autorizada</desc></programme></tv>`;
        fixtureServer = createServer((req, res) => {
            if (req.url === '/epg.xml') {
                res.writeHead(200, { 'Content-Type': 'application/xml' });
                res.end(epg);
            } else if (req.url === '/demo.m3u') {
                res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
                res.end(
                    `#EXTM3U\n#EXTINF:-1 tvg-id="aurora.demo" group-title="Exemplos",Aurora Demo\n${fixtureUrl}/fixture.mp4\n`
                );
            } else if (
                /^\/fixture(?:\d+)?\.(mp4|m3u8|ts)$/.test(req.url || '')
            ) {
                mediaRequests.push(req.url || '');
                const file = join(profileRoot, (req.url || '').slice(1));
                const data = readFileSync(file);
                const contentType = file.endsWith('.mp4')
                    ? 'video/mp4'
                    : file.endsWith('.ts')
                      ? 'video/mp2t'
                      : 'application/vnd.apple.mpegurl';
                const range = /^bytes=(\d+)-(\d*)$/.exec(
                    req.headers.range || ''
                );
                const start = range ? Number(range[1]) : 0;
                const end =
                    range && range[2]
                        ? Math.min(Number(range[2]), data.length - 1)
                        : data.length - 1;
                res.writeHead(range ? 206 : 200, {
                    'Content-Type': contentType,
                    'Content-Length': end - start + 1,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    ...(range
                        ? {
                              'Content-Range': `bytes ${start}-${end}/${data.length}`,
                          }
                        : {}),
                });
                res.end(
                    req.method === 'HEAD'
                        ? undefined
                        : data.subarray(start, end + 1)
                );
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        await new Promise<void>((resolve) =>
            fixtureServer.listen(0, '127.0.0.1', resolve)
        );
        fixtureUrl = `http://127.0.0.1:${(fixtureServer.address() as { port: number }).port}`;
        console.log(`Launching Electron app from: ${electronMainPath}`);
        console.log(`Platform: ${process.platform}`);
        console.log(`CI: ${process.env['CI']}`);

        // Check if web build exists
        const webIndexPath = join(workspaceRoot, 'dist/apps/web/index.html');
        console.log(`Web index path: ${webIndexPath}`);
        console.log(`Web index exists: ${existsSync(webIndexPath)}`);

        // Launch the Electron app
        // On Linux CI, we need to disable sandbox due to permission issues
        const args = process.env.AURORA_E2E_EXECUTABLE
            ? []
            : [electronMainPath];
        if (process.platform === 'linux' && process.env['CI']) {
            args.unshift('--no-sandbox', '--disable-gpu');
        }

        const launchEnv = {
            ...process.env,
            NODE_ENV: 'test',
            ELECTRON_IS_DEV: '0',
            AURORA_DATA_DIR: profileRoot,
        };
        delete launchEnv.ELECTRON_RUN_AS_NODE;
        if (process.env.AURORA_E2E_EXECUTABLE) {
            // The package must use its own resources even in a misleading host environment.
            launchEnv['FFMPEG_BIN'] = join(profileRoot, 'missing-development-ffmpeg.exe');
            launchEnv['NODE_PATH'] = join(profileRoot, 'no-development-modules');
        }
        electronApp = await electron.launch({
            cwd: profileRoot,
            ...(process.env.AURORA_E2E_EXECUTABLE
                ? { executablePath: process.env.AURORA_E2E_EXECUTABLE }
                : {}),
            args,
            env: launchEnv,
        });
        for (const stream of [
            electronApp.process().stdout,
            electronApp.process().stderr,
        ]) {
            stream?.on('data', (chunk) =>
                appendFileSync(join(profileRoot, 'electron.log'), chunk)
            );
        }

        // Find the main application window (not DevTools)
        mainWindow = await findMainWindow(electronApp);

        // Wait for the window to be fully loaded
        await mainWindow.waitForLoadState('domcontentloaded');

        // Debug: Log the current URL
        const url = mainWindow.url();
        console.log(`Page URL: ${url}`);

        // Wait for Angular to bootstrap and render
        await mainWindow.waitForSelector('app-root', { timeout: 30000 });

        // Wait for Angular to fully initialize and set the title
        await mainWindow.waitForFunction(() => document.title.length > 0, {
            timeout: 30000,
        });

        console.log('Electron app launched successfully');
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
        if (fixtureServer)
            await new Promise<void>((resolve) =>
                fixtureServer.close(() => resolve())
            );
        const mainLog = join(profileRoot, 'logs', 'main-process.log');
        expect(existsSync(mainLog)).toBe(true);
        expect(readFileSync(mainLog, 'utf8')).not.toMatch(/uncaught:|loading-main-failed/);
    });

    test('app should start and display main window', async () => {
        expect(mainWindow).toBeTruthy();

        await mainWindow.screenshot({
            path: join(screenshotDir, 'smoke-test-screenshot.png'),
            fullPage: true,
        });

        const title = await mainWindow.title();
        console.log(`Window title: ${title}`);
        expect(title).toContain('IPTV AURORA EXPERT');
    });

    test('app should have expected window properties', async () => {
        const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            return mainWindow ? mainWindow.isVisible() : false;
        });
        expect(isVisible).toBe(true);

        const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            return mainWindow ? mainWindow.getBounds() : null;
        });
        expect(bounds).not.toBeNull();
        expect(bounds?.width).toBeGreaterThan(800);
        expect(bounds?.height).toBeGreaterThanOrEqual(600);

        await mainWindow.screenshot({
            path: join(screenshotDir, 'window-properties-screenshot.png'),
        });
    });

    test('app should render main content', async () => {
        // Wait for app-root to have actual content
        await mainWindow.waitForFunction(
            () => {
                const appRoot = document.querySelector('app-root');
                return appRoot && appRoot.innerHTML.trim().length > 0;
            },
            { timeout: 30000 }
        );

        const bodyContent = await mainWindow.locator('body').innerHTML();
        expect(bodyContent.length).toBeGreaterThan(0);

        await mainWindow.screenshot({
            path: join(screenshotDir, 'rendered-content-screenshot.png'),
            fullPage: true,
        });

        console.log('Smoke test completed successfully');
    });

    test('uses a dedicated profile, empty database and Aurora downloads', async () => {
        const profile = await electronApp.evaluate(({ app }) => ({
            name: app.getName(),
            userData: app.getPath('userData'),
        }));
        expect(profile.name).toBe('IPTV AURORA EXPERT');
        expect(
            await mainWindow.evaluate(() => window.electron.getAppVersion())
        ).toBe(
            JSON.parse(
                readFileSync(join(workspaceRoot, 'package.json'), 'utf8')
            ).version
        );
        expect(profile.userData).toBe(join(profileRoot, 'profile'));
        await expect
            .poll(() =>
                mainWindow.evaluate(() => window.electron.dbGetAllPlaylists())
            )
            .toEqual([]);
        expect(existsSync(join(profileRoot, 'databases', 'aurora.db'))).toBe(
            true
        );
        const downloads = await mainWindow.evaluate(() =>
            window.electron.downloadsGetDefaultFolder()
        );
        expect(downloads).toBe(join(profileRoot, 'downloads'));
    });

    test('opens settings, preserves all five import choices and imports text M3U', async () => {
        await mainWindow.locator('[data-test-id="open-settings"]').click();
        await expect(
            mainWindow.locator('[data-test-id="settings-container"]')
        ).toBeVisible();
        await mainWindow.locator('[data-test-id="back-to-home"]').click();
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        const menu = mainWindow.locator('.mat-mdc-menu-panel');
        await expect(menu.locator('button')).toHaveCount(5);
        await menu.getByRole('menuitem', { name: 'Importar do texto' }).click();
        await mainWindow
            .locator('app-text-import textarea')
            .fill(
                `#EXTM3U\n#EXTINF:-1 tvg-id="aurora.demo" group-title="Exemplos",Aurora Demo UI\n${fixtureUrl}/fixture.mp4\n#EXTINF:-1 group-title="Exemplos",Aurora HLS UI\n${fixtureUrl}/fixture.m3u8`
            );
        await mainWindow
            .locator('app-text-import button[type="submit"]')
            .click();
        await expect(
            mainWindow
                .locator('[data-test-id="channel-item"]')
                .filter({ hasText: 'Aurora Demo UI' })
        ).toBeVisible();
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-m3u-navigation.png'),
            fullPage: true,
        });
    });

    test('plays synthetic MP4 and HLS in the internal player', async () => {
        await mainWindow.evaluate(() => {
            const original = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return original.call(this);
            };
        });
        for (const channel of ['Aurora Demo UI', 'Aurora HLS UI']) {
            const previousSrc = await mainWindow.evaluate(
                () => document.querySelector('video')?.currentSrc || ''
            );
            await mainWindow
                .locator('[data-test-id="channel-item"]')
                .filter({ hasText: channel })
                .click();
            await expect
                .poll(
                    () =>
                        mainWindow.evaluate((previous) => {
                            const video = document.querySelector('video');
                            return (
                                !!video &&
                                video.currentSrc !== previous &&
                                video.readyState >= 2 &&
                                video.currentTime > 0 &&
                                !video.error
                            );
                        }, previousSrc),
                    { timeout: 30000 }
                )
                .toBe(true);
        }
        expect(mediaRequests).toContain('/fixture.m3u8');
        expect(mediaRequests.some((url) => url.endsWith('.ts'))).toBe(true);
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-hls-playing.png'),
            fullPage: true,
        });
    });

    test('parses M3U URL and imports XMLTV through the real EPG worker', async () => {
        const result = await mainWindow.evaluate(async (base) => {
            const playlist = await window.electron.fetchPlaylistByUrl(
                base + '/demo.m3u'
            );
            const epg = await window.electron.fetchEpg([base + '/epg.xml']);
            return { playlist, epg };
        }, fixtureUrl);
        expect(JSON.stringify(result.playlist)).toContain('Aurora Demo');
        await expect
            .poll(
                async () =>
                    JSON.stringify(
                        await mainWindow.evaluate(() =>
                            window.electron.getChannelPrograms('aurora.demo')
                        )
                    ),
                { timeout: 30000 }
            )
            .toContain('Programa ficticio Aurora');
        const fresh = await mainWindow.evaluate(
            (base) =>
                window.electron.checkEpgFreshness([base + '/epg.xml'], 12),
            fixtureUrl
        );
        expect(fresh.freshUrls).toContain(fixtureUrl + '/epg.xml');
        await mainWindow.evaluate(() => window.electron.clearEpgData());
        expect(
            await mainWindow.evaluate(() => window.electron.getEpgChannels())
        ).toEqual({ channels: [], programs: [] });
    });

    test('persists categories, search, favorites, history and resume through IPC', async () => {
        const result = await mainWindow.evaluate(async () => {
            const api = window.electron;
            const id = 'aurora-fixture';
            await api.dbCreatePlaylist({
                id,
                name: 'Catalogo ficticio',
                type: 'xtream',
                serverUrl: 'https://example.invalid',
            });
            await api.dbSaveCategories(
                id,
                [{ category_id: 42, category_name: 'Exemplos' }],
                'movies'
            );
            await api.dbSaveContent(
                id,
                [{ stream_id: 101, name: 'Filme ficticio', category_id: '42' }],
                'movie'
            );
            const items = await api.dbGetContent(id, 'movie');
            const item = items[0];
            await api.dbAddFavorite(item.id, id);
            await api.dbAddRecentItem(item.id, id);
            await api.dbSavePlaybackPosition(id, {
                contentXtreamId: 101,
                contentType: 'vod',
                positionSeconds: 45,
                durationSeconds: 120,
            });
            const categories = await api.dbGetAllCategories(id, 'movies');
            await api.dbUpdateCategoryVisibility([categories[0].id], true);
            const hidden = await api.dbGetCategories(id, 'movies');
            await api.dbUpdateCategoryVisibility([categories[0].id], false);
            return {
                favorite: await api.dbIsFavorite(item.id, id),
                recent: await api.dbGetRecentItems(id),
                position: await api.dbGetPlaybackPosition(id, 101, 'vod'),
                hidden,
                search: await api.dbSearchContent(id, 'ficticio', ['movie']),
            };
        });
        expect(result.favorite).toBe(true);
        expect(result.recent).toHaveLength(1);
        expect(result.position.positionSeconds).toBe(45);
        expect(result.hidden).toHaveLength(0);
        expect(JSON.stringify(result.search)).toContain('Filme ficticio');
    });

    test('downloads synthetic media into the dedicated Aurora folder', async () => {
        await mainWindow.evaluate(
            (base) =>
                window.electron.downloadsStart({
                    playlistId: 'aurora-download',
                    playlistName: 'Exemplo autorizado',
                    playlistType: 'm3u-text',
                    xtreamId: 301,
                    contentType: 'vod',
                    title: 'Video sintetico Aurora',
                    url: base + '/fixture.mp4',
                    downloadFolder: '',
                }),
            fixtureUrl
        );
        await expect
            .poll(
                async () => {
                    const rows = await mainWindow.evaluate(() =>
                        window.electron.downloadsGetList('aurora-download')
                    );
                    return rows[0]?.status;
                },
                { timeout: 30000 }
            )
            .toBe('completed');
        const rows = await mainWindow.evaluate(() =>
            window.electron.downloadsGetList('aurora-download')
        );
        expect(rows[0].filePath).toContain(join(profileRoot, 'downloads'));
        expect(existsSync(rows[0].filePath)).toBe(true);
    });

    test('transcodes audio with the FFmpeg shipped in the package', async () => {
        const result = await mainWindow.evaluate(async (base) => {
            const port = await window.electron.getStreamProxyPort();
            const url = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(base + '/fixture.mp4')}&transcode=audio`;
            const response = await fetch(url);
            const bytes = await response.arrayBuffer();
            return {
                status: response.status,
                type: response.headers.get('content-type'),
                size: bytes.byteLength,
                fragmented: new TextDecoder('latin1')
                    .decode(bytes)
                    .includes('moof'),
            };
        }, fixtureUrl);
        expect(result.status).toBe(200);
        expect(result.type).toContain('video/mp4');
        expect(result.size).toBeGreaterThan(1000);
        expect(result.fragmented).toBe(true);
    });
});

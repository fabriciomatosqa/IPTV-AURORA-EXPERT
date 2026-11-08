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
    writeFileSync,
    createReadStream,
    statSync,
} from 'fs';
import { createHash } from 'crypto';
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
const releasePackage = JSON.parse(
    readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')
);
let updateAvailable = false;

function syntheticCatalog(): string {
    const rows = ['#EXTM3U'];
    for (let i = 1; i <= 36; i++)
        rows.push(
            `#EXTINF:-1 tvg-logo="${fixtureUrl}/logo.svg" group-title="${i % 2 ? 'TV | Cultura' : 'TV | Notícias'}",Aurora Canal ${String(i).padStart(2, '0')}\n${fixtureUrl}/fixture.mp4?channel=${i}`
        );
    for (const type of ['Filmes', 'Séries'])
        for (let i = 1; i <= 12; i++) {
            rows.push(
                `#EXTINF:-1 tvg-logo="${fixtureUrl}/poster.svg" group-title="${type === 'Filmes' ? ['♦ Ação ✔', '♦ Cinema ⭐', '♦ UHD|4K ⭐'][i % 3] : ['♦ Netflix', '♦ Doramas', '♦ Novelas Turcas'][i % 3]}",${type === 'Filmes' ? 'Horizonte' : 'Jornada'} Aurora ${String(i).padStart(2, '0')}${type === 'Séries' ? ' 1x01' : ''}\n${fixtureUrl}/fixture.mp4?type=${encodeURIComponent(type)}&item=${i}`
            );
            if (type === 'Séries')
                rows.push(
                    `#EXTINF:-1 tvg-logo="${fixtureUrl}/poster.svg" group-title="${['♦ Netflix', '♦ Doramas', '♦ Novelas Turcas'][i % 3]}",Jornada Aurora ${String(i).padStart(2, '0')} Temporada 2 Episódio 1\n${fixtureUrl}/fixture.mp4?type=series&item=${i}&season=2`
                );
        }
    return rows.join('\n') + '\n';
}

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
        profileRoot = mkdtempSync(
            join(
                process.env.AURORA_E2E_PROFILE_BASE || screenshotDir,
                'aurora-profile-'
            )
        );
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
        // A valid but non-faststart movie stores its MP4 index at the end.
        // This is the format the old piped FFmpeg transcode could not seek.
        const slowStartGenerated = spawnSync(
            ffmpeg,
            [
                '-hide_banner', '-loglevel', 'error',
                '-i', videoFile,
                '-c', 'copy',
                join(profileRoot, 'fixture-slowstart.mp4'),
            ],
            { windowsHide: true }
        );
        expect(
            slowStartGenerated.status,
            slowStartGenerated.stderr?.toString()
        ).toBe(0);
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
        const tsGenerated = spawnSync(
            ffmpeg,
            [
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                videoFile,
                '-c',
                'copy',
                '-f',
                'mpegts',
                join(profileRoot, 'fixture.ts'),
            ],
            { windowsHide: true }
        );
        expect(tsGenerated.status, tsGenerated.stderr?.toString()).toBe(0);
        const xmlDate = (date: Date) =>
            date.toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000';
        const epg = `<?xml version="1.0"?><tv><channel id="aurora.demo"><display-name>Aurora Demo</display-name></channel><programme start="${xmlDate(new Date(Date.now() - 3600000))}" stop="${xmlDate(new Date(Date.now() + 3600000))}" channel="aurora.demo"><title>Programa ficticio Aurora</title><desc>Fixture local autorizada</desc></programme></tv>`;
        fixtureServer = createServer((req, res) => {
            const requestPath = (req.url || '').split('?')[0];
            if (requestPath === '/latest.yml') {
                const installer = process.env.AURORA_E2E_UPDATE_INSTALLER;
                const bytes = installer
                    ? readFileSync(installer)
                    : Buffer.from('fixture');
                const sha512 = createHash('sha512')
                    .update(bytes)
                    .digest('base64');
                const version = updateAvailable
                    ? releasePackage.version.replace(/\d+$/, (n: string) =>
                          String(Number(n) + 1)
                      )
                    : releasePackage.version;
                res.writeHead(200, { 'Content-Type': 'text/yaml' });
                res.end(
                    JSON.stringify({
                        version,
                        releaseName: updateAvailable
                            ? 'Validação local de atualização'
                            : releasePackage.auroraVersion,
                        files: [
                            { url: 'update.exe', size: bytes.length, sha512 },
                        ],
                        path: 'update.exe',
                        sha512,
                    })
                );
            } else if (
                requestPath === '/update.exe' &&
                process.env.AURORA_E2E_UPDATE_INSTALLER
            ) {
                const file = process.env.AURORA_E2E_UPDATE_INSTALLER;
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': statSync(file).size,
                });
                createReadStream(file).pipe(res);
            } else if (requestPath === '/player_api.php') {
                const action = new URL(
                    req.url || '',
                    'http://localhost'
                ).searchParams.get('action');
                let data: unknown;
                if (action === 'get_account_info' || !action)
                    data = {
                        user_info: {
                            auth: 1,
                            status: 'Active',
                            exp_date: String(
                                Math.floor(Date.now() / 1000) + 86400 * 30
                            ),
                        },
                        server_info: {
                            url: '127.0.0.1',
                            port: new URL(fixtureUrl).port,
                        },
                    };
                else if (action?.endsWith('_categories'))
                    data = [
                        {
                            category_id:
                                action === 'get_live_categories'
                                    ? '1'
                                    : action === 'get_vod_categories'
                                      ? '2'
                                      : '3',
                            category_name: 'Catálogo sintético',
                        },
                    ];
                else if (action === 'get_vod_info')
                    data = {
                        info: {
                            name: 'Horizonte Aurora',
                            movie_image: fixtureUrl + '/poster.svg',
                            plot: 'Filme sintético de validação. Imagens e mídia geradas localmente para os testes do AURORA.',
                            director: 'Direção Aurora',
                            actors: 'Artista Aurora A, Artista Aurora B',
                            duration: '12 segundos',
                            releasedate: '2026-01-01',
                            genre: 'Demonstração',
                            rating_imdb: '8.0',
                        },
                        movie_data: {
                            stream_id: 1,
                            name: 'Horizonte Aurora',
                            container_extension: 'mp4',
                        },
                    };
                else if (action === 'get_series_info')
                    data = {
                        info: {
                            name: 'Jornada Aurora',
                            cover: fixtureUrl + '/poster.svg',
                            plot: 'Série sintética para validação local.',
                        },
                        seasons: [
                            { season_number: 1, name: 'Temporada 1' },
                            { season_number: 2, name: 'Temporada 2' },
                        ],
                        episodes: Object.fromEntries(
                            [1, 2].map((season) => [
                                String(season),
                                Array.from({ length: 9 }, (_, i) => ({
                                    id: String(200 + season * 10 + i),
                                    episode_num: i + 1,
                                    season,
                                    title: `Jornada Aurora S0${season}E${String(i + 1).padStart(2, '0')}`,
                                    container_extension: 'mp4',
                                    info: {
                                        movie_image: fixtureUrl + '/poster.svg',
                                    },
                                })),
                            ])
                        ),
                    };
                else if (action === 'get_short_epg')
                    data = { epg_listings: [] };
                else
                    data = Array.from(
                        { length: action === 'get_live_streams' ? 1 : 12 },
                        (_, i) => ({
                            stream_id: i + 1,
                            series_id: i + 101,
                            name: `${action === 'get_series' ? 'Jornada' : 'Cinema'} Aurora ${String(i + 1).padStart(2, '0')}`,
                            stream_icon: fixtureUrl + '/poster.svg',
                            cover: fixtureUrl + '/poster.svg',
                            category_id:
                                action === 'get_live_streams'
                                    ? '1'
                                    : action === 'get_vod_streams'
                                      ? '2'
                                      : '3',
                            container_extension: 'mp4',
                            added: '1',
                        })
                    );
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            } else if (
                req.url === '/empty.m3u' ||
                req.url === '/invalid.m3u' ||
                req.url === '/denied.m3u'
            ) {
                res.writeHead(req.url === '/denied.m3u' ? 401 : 200, {
                    'Content-Type': 'text/plain',
                });
                res.end(
                    req.url === '/empty.m3u'
                        ? '#EXTM3U\n'
                        : '<html>Unauthorized synthetic response</html>'
                );
            } else if (req.url === '/poster.svg' || req.url === '/logo.svg') {
                res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
                res.end(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#12343e"/><stop offset=".5" stop-color="#347d70"/><stop offset="1" stop-color="#382457"/></linearGradient></defs><rect width="300" height="450" fill="url(#g)"/><circle cx="180" cy="180" r="95" fill="none" stroke="#94ead3" stroke-width="2"/><path d="M0 320L150 90 300 320" fill="none" stroke="#94ead3" stroke-width="3"/><text x="150" y="365" fill="white" font-family="sans-serif" text-anchor="middle" font-size="28">AURORA</text><text x="150" y="395" fill="#c5dfdb" font-family="sans-serif" text-anchor="middle" font-size="12">CONTEUDO SINTETICO</text></svg>'
                );
            } else if (req.url === '/large.m3u') {
                const rows = ['#EXTM3U'];
                for (let i = 0; i < 20000; i++)
                    rows.push(
                        `#EXTINF:-1 group-title="TV",Canal ${i}\n${fixtureUrl}/live/${i}.ts`
                    );
                for (let i = 0; i < 100; i++)
                    rows.push(
                        `#EXTINF:-1 group-title="♦ Ação ✔",Filme ${i}\n${fixtureUrl}/vod/${i}.ts`
                    );
                res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
                setTimeout(() => res.end(rows.join('\n') + '\n'), 300);
            } else if (req.url?.startsWith('/get.php')) {
                res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
                res.end(
                    `#EXTM3U\n#EXTINF:-1 group-title="TV",Somente TV\n${fixtureUrl}/fixture.ts\n`
                );
            } else if (
                req.url === '/catalog.m3u' ||
                req.url === '/delayed-catalog.m3u'
            ) {
                res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
                if (req.url === '/delayed-catalog.m3u')
                    setTimeout(() => res.end(syntheticCatalog()), 1500);
                else res.end(syntheticCatalog());
            } else if (req.url === '/epg.xml') {
                res.writeHead(200, { 'Content-Type': 'application/xml' });
                res.end(epg);
            } else if (req.url === '/demo.m3u') {
                res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' });
                res.end(
                    `#EXTM3U\n#EXTINF:-1 tvg-id="aurora.demo" group-title="Exemplos",Aurora Demo\n${fixtureUrl}/fixture.mp4\n`
                );
            } else if (
                /^\/fixture(?:\d+)?\.(mp4|m3u8|ts)$/.test(requestPath) ||
                requestPath === '/fixture-slowstart.mp4' ||
                /^\/(movie|series)\/synthetic\/synthetic\/\d+\.mp4$/.test(
                    requestPath
                )
            ) {
                mediaRequests.push(req.url || '');
                const file = join(
                    profileRoot,
                    requestPath.startsWith('/movie/') ||
                        requestPath.startsWith('/series/')
                        ? 'fixture.mp4'
                        : requestPath.slice(1)
                );
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
            AURORA_UPDATE_TEST_FEED: fixtureUrl + '/',
            LOCALAPPDATA: join(profileRoot, 'local-app-data'),
        };
        delete launchEnv.ELECTRON_RUN_AS_NODE;
        if (process.env.AURORA_E2E_EXECUTABLE) {
            // The package must use its own resources even in a misleading host environment.
            launchEnv['FFMPEG_BIN'] = join(
                profileRoot,
                'missing-development-ffmpeg.exe'
            );
            launchEnv['NODE_PATH'] = join(
                profileRoot,
                'no-development-modules'
            );
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
        expect(readFileSync(mainLog, 'utf8')).not.toMatch(
            /uncaught:|loading-main-failed/
        );
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

    test('opens the new four-card dashboard and keeps playlist management accessible', async () => {
        await expect(mainWindow.locator('[data-test-id="aurora-home-dashboard"]')).toBeVisible();
        for (const section of ['live', 'movies', 'series', 'favorites']) {
            await expect(mainWindow.locator(`[data-test-id="home-card-${section}"]`)).toBeVisible();
            await expect(mainWindow.locator(`[data-test-id="home-card-${section}"]`)).toBeDisabled();
        }
        await mainWindow.locator('[data-test-id="home-open-playlists"]').click();
        await expect(mainWindow.locator('app-recent-playlists')).toBeVisible();
        await mainWindow.evaluate(() => { location.hash = '#/'; });
        await expect(mainWindow.locator('[data-test-id="aurora-home-dashboard"]')).toBeVisible();
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

    test('seekable FFmpeg VOD conversion plays a slow-start MP4 in Electron', async () => {
        test.setTimeout(60000);
        const port = await mainWindow.evaluate(() =>
            window.electron?.getStreamProxyPort?.()
        );
        expect(port).toBeGreaterThan(0);
        const stream = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(
            fixtureUrl + '/fixture-slowstart.mp4'
        )}&transcode=1`;
        const result = await mainWindow.evaluate(async (url) => {
            const video = document.createElement('video');
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;
            video.style.width = '100px';
            video.style.height = '60px';
            document.body.appendChild(video);
            return await new Promise<{
                played: boolean;
                currentTime: number;
                errorCode?: number;
            }>((resolve) => {
                let finished = false;
                const done = (played: boolean) => {
                    if (finished) return;
                    finished = true;
                    window.clearTimeout(timeout);
                    const currentTime = video.currentTime;
                    const errorCode = video.error?.code;
                    video.pause();
                    video.removeAttribute('src');
                    video.load();
                    video.remove();
                    resolve({ played, currentTime, errorCode });
                };
                const timeout = window.setTimeout(() => done(false), 35000);
                video.addEventListener('timeupdate', () => {
                    if (video.currentTime > 0.15) done(true);
                });
                video.addEventListener('error', () => done(false));
                video.src = url;
                void video.play().catch(() => done(false));
            });
        }, stream);
        expect(result, 'FFmpeg must play at least 150 ms').toMatchObject({
            played: true,
        });
        expect(result.currentTime).toBeGreaterThan(0.15);
    });

    test('native Picture in Picture is resizable, snappable and returns to full-app player', async () => {
        const openedWindow = electronApp.waitForEvent('window', {
            timeout: 30000,
        });
        const opened = await mainWindow.evaluate((url) =>
            window.electron.openAuroraPiP?.({
                streamUrl: url,
                title: 'Aurora Teste PiP',
                startTime: 0,
            }), fixtureUrl + '/fixture.mp4');
        expect(opened).toBe(true);

        const pipPage = await openedWindow;
        await expect(pipPage.locator('app-floating-player')).toBeVisible({
            timeout: 20000,
        });
        const pipMarkup = await pipPage.locator('app-floating-player').innerHTML();
        console.log('[PiP E2E] rendered content:', pipMarkup.slice(0, 2500));
        await expect(pipPage.locator('.aurora-pip-toolbar')).toBeVisible({
            timeout: 10000,
        });
        const nativeWindow = await electronApp.evaluate(({ BrowserWindow }) => {
            const floating = BrowserWindow.getAllWindows().find((win) =>
                win.getTitle().includes('Picture in Picture')
            );
            if (!floating) return null;
            floating.setSize(360, 240);
            return {
                width: floating.getBounds().width,
                height: floating.getBounds().height,
                resizable: floating.isResizable(),
                maximizable: floating.isMaximizable(),
                frame: floating.getTitle(),
            };
        });
        expect(nativeWindow).toBeTruthy();
        expect(nativeWindow?.resizable).toBe(true);
        expect(nativeWindow?.maximizable).toBe(true);
        expect(nativeWindow?.width).toBe(360);
        expect(nativeWindow?.height).toBe(240);
        await pipPage.locator('[data-test-id="pip-always-on-top"]').click();
        const isAlwaysOnTop = await electronApp.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().some(
                (win) =>
                    win.getTitle().includes('Picture in Picture') &&
                    win.isAlwaysOnTop()
            )
        );
        expect(isAlwaysOnTop).toBe(true);
        await pipPage.locator('[data-test-id="pip-return"]').click();
        const dialog = mainWindow.locator('.aurora-player-dialog');
        await expect(dialog).toBeVisible({ timeout: 20000 });
        const dialogSize = await dialog.boundingBox();
        const viewport = mainWindow.viewportSize();
        expect(dialogSize?.width).toBeGreaterThan((viewport?.width || 900) - 12);
        expect(dialogSize?.height).toBeGreaterThan((viewport?.height || 600) - 12);
        await mainWindow.getByRole('button', { name: 'Fechar player' }).click();
        await expect(dialog).not.toBeVisible();
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
            ).auroraVersion ||
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
                `#EXTM3U\n#EXTINF:-1 tvg-id="aurora.demo" group-title="TV | Exemplos",Aurora Demo UI\n${fixtureUrl}/fixture.mp4\n#EXTINF:-1 group-title="TV | Exemplos",Aurora HLS UI\n${fixtureUrl}/fixture.m3u8\n#EXTINF:-1 group-title="TV | Exemplos",Aurora TS UI\n${fixtureUrl}/fixture.ts`
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

    test('home shortcuts open the selected M3U content without losing the playlist', async () => {
        await mainWindow.evaluate(() => { location.hash = '#/'; });
        await expect(mainWindow.locator('[data-test-id="aurora-home-dashboard"]')).toBeVisible();
        await expect(mainWindow.locator('[data-test-id="home-playlist-selector"]')).toBeVisible();
        const sections = [
            ['movies', 'Filmes'],
            ['series', 'Séries'],
            ['favorites', 'Favoritos'],
            ['live', 'TV ao vivo'],
        ] as const;
        for (const [section, label] of sections) {
            await mainWindow.locator(`[data-test-id="home-card-${section}"]`).click();
            await expect(mainWindow.locator('.library-rail-links button.active')).toContainText(label);
            await mainWindow.locator('.library-brand').click();
            await expect(mainWindow.locator('[data-test-id="aurora-home-dashboard"]')).toBeVisible();
        }
        await mainWindow.locator('[data-test-id="home-card-live"]').click();
        await expect(mainWindow.locator('[data-test-id="channel-item"]').first()).toBeVisible();
    });

    test('plays synthetic MP4, HLS and raw MPEG-TS with channel changes', async () => {
        await mainWindow.evaluate(() => {
            const original = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return original.call(this);
            };
        });
        for (const channel of [
            'Aurora Demo UI',
            'Aurora HLS UI',
            'Aurora TS UI',
        ]) {
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
            const videoBounds = await mainWindow.locator('video').boundingBox();
            expect(videoBounds!.y + videoBounds!.height).toBeLessThanOrEqual(
                await mainWindow.evaluate(() => innerHeight + 1)
            );
            if (channel === 'Aurora Demo UI') {
                await mainWindow.locator('.video-js').hover();
                await mainWindow.locator('.vjs-play-control').click();
                await expect
                    .poll(() =>
                        mainWindow
                            .locator('video')
                            .evaluate((v) => (v as HTMLVideoElement).paused)
                    )
                    .toBe(true);
                await mainWindow.locator('.vjs-play-control').click();
                await expect
                    .poll(() =>
                        mainWindow
                            .locator('video')
                            .evaluate((v) => (v as HTMLVideoElement).paused)
                    )
                    .toBe(false);
                await mainWindow.locator('.vjs-fullscreen-control').click();
                await expect
                    .poll(() =>
                        mainWindow.evaluate(() => !!document.fullscreenElement)
                    )
                    .toBe(true);
                await mainWindow.screenshot({
                    path: join(screenshotDir, 'aurora-fullscreen.png'),
                });
                await mainWindow.locator('.vjs-fullscreen-control').click();
                await expect
                    .poll(() =>
                        mainWindow.evaluate(() => !!document.fullscreenElement)
                    )
                    .toBe(false);
            }
            await mainWindow.screenshot({
                path: join(
                    screenshotDir,
                    `aurora-playing-${channel.includes('HLS') ? 'hls' : channel.includes('TS') ? 'mpegts' : 'mp4'}.png`
                ),
            });
            await mainWindow
                .getByRole('button', { name: 'Voltar ao catálogo' })
                .click();
        }
        expect(mediaRequests).toContain('/fixture.m3u8');
        expect(mediaRequests.some((url) => url.endsWith('.ts'))).toBe(true);
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-hls-playing.png'),
            fullPage: true,
        });
    });

    test('reports invalid URL, authentication, format and empty catalog in the UI, then imports by URL', async () => {
        for (const [path, message] of [
            ['https://', 'Endereço inválido'],
            [fixtureUrl + '/denied.m3u', 'Autenticação recusada'],
            [fixtureUrl + '/invalid.m3u', 'não é uma lista M3U válida'],
            [fixtureUrl + '/empty.m3u', 'Catálogo vazio'],
        ]) {
            if (await mainWindow.locator('.library-playlists').isVisible())
                await mainWindow.locator('.library-playlists').click();
            await mainWindow.locator('[data-test-id="add-playlist"]').click();
            await mainWindow
                .getByRole('menuitem', { name: 'Adicionar via URL' })
                .click();
            await mainWindow.locator('app-url-upload input').fill(path);
            await mainWindow
                .locator('app-url-upload button[type="submit"]')
                .click();
            await expect(
                mainWindow
                    .locator('mat-snack-bar-container')
                    .filter({ hasText: message })
            ).toBeVisible();
            await mainWindow
                .getByRole('button', { name: 'Fechar', exact: true })
                .click();
            // A failed import remains on the home screen.
            await mainWindow.locator('[data-test-id="add-playlist"]').waitFor();
            if (path !== fixtureUrl + '/empty.m3u') {
                // The next iteration also starts from home.
                await mainWindow.evaluate(() => (location.hash = '#/'));
            }
        }
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        await mainWindow
            .getByRole('menuitem', { name: 'Adicionar via URL' })
            .click();
        await mainWindow
            .locator('app-url-upload input')
            .fill(fixtureUrl + '/delayed-catalog.m3u');
        await mainWindow
            .locator('app-url-upload button[type="submit"]')
            .click();
        await expect(
            mainWindow.locator('[data-test-id="playlist-loading"]')
        ).toBeVisible();
        await expect(
            mainWindow.locator('[data-test-id="playlist-loading"]')
        ).toBeHidden();
        await expect(
            mainWindow.locator('[data-test-id="aurora-catalog"]')
        ).toBeVisible();
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(36);
    });

    test('filters categories, searches, toggles favorites and browses movie and series posters at desktop sizes', async () => {
        await mainWindow
            .locator('#aurora-category')
            .selectOption('TV | Notícias');
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(18);
        await mainWindow
            .getByRole('searchbox', { name: 'Pesquisar no catálogo' })
            .fill('Canal 02');
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(1);
        await mainWindow
            .getByRole('button', {
                name: 'Adicionar favorito: Aurora Canal 02',
                exact: true,
            })
            .click();
        await mainWindow
            .locator('.library-rail-links')
            .getByRole('button', { name: 'Favoritos', exact: true })
            .click();
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(1);
        await mainWindow
            .locator('mat-snack-bar-container')
            .waitFor({ state: 'detached' });
        await mainWindow
            .locator('.library-rail-links')
            .getByRole('button', { name: 'TV ao vivo', exact: true })
            .click();
        for (const [width, height] of [
            [1366, 768],
            [1920, 1080],
        ]) {
            await mainWindow.setViewportSize({ width, height });
            await mainWindow.screenshot({
                path: join(screenshotDir, `aurora-live-${width}.png`),
            });
            for (const section of ['Filmes', 'Séries']) {
                await mainWindow
                    .locator('.library-rail-links')
                    .getByRole('button', { name: section, exact: true })
                    .click();
                await expect(
                    mainWindow.locator(
                        '.poster-grid [data-test-id="channel-item"]'
                    )
                ).toHaveCount(12);
                const m3uCategories = mainWindow.locator(
                    '[data-test-id="m3u-category-sidebar"]'
                );
                await expect(m3uCategories).toBeVisible();
                await m3uCategories.locator('.library-category-list button').nth(1).click();
                await expect(m3uCategories).toBeVisible();
                await expect(
                    mainWindow.locator('.poster-grid [data-test-id="channel-item"]')
                ).not.toHaveCount(12);
                await m3uCategories.locator('.library-category-list button').first().click();
                await expect(
                    mainWindow.locator('.poster-grid [data-test-id="channel-item"]')
                ).toHaveCount(12);
                await mainWindow.screenshot({
                    path: join(
                        screenshotDir,
                        `aurora-${section === 'Filmes' ? 'movies' : 'series'}-${width}.png`
                    ),
                });
                expect(
                    await mainWindow.evaluate(
                        () => document.documentElement.scrollWidth <= innerWidth
                    )
                ).toBe(true);
                await mainWindow
                    .locator('.poster-grid [data-test-id="channel-item"]')
                    .first()
                    .click();
                await expect(
                    mainWindow.locator('app-content-hero h1')
                ).toContainText(
                    section === 'Filmes' ? 'Horizonte Aurora' : 'Jornada Aurora'
                );
                const poster = await mainWindow
                    .locator('app-content-hero .poster')
                    .boundingBox();
                const title = await mainWindow
                    .locator('app-content-hero h1')
                    .boundingBox();
                expect(poster!.x).toBeGreaterThan(title!.x + title!.width);
                if (section === 'Séries')
                    await expect(mainWindow.locator('.m3u-season')).toHaveCount(
                        2
                    );
                await mainWindow.screenshot({
                    path: join(
                        screenshotDir,
                        `aurora-m3u-${section === 'Filmes' ? 'movie-details' : 'series-details'}-${width}.png`
                    ),
                });
                await mainWindow
                    .getByRole('button', {
                        name: 'Voltar ao catálogo',
                        exact: true,
                    })
                    .click();
            }
            await mainWindow
                .locator('.library-rail-links')
                .getByRole('button', { name: 'TV ao vivo', exact: true })
                .click();
        }
    });

    test('imports an actual file through the native dialog and keeps the import open after invalid content', async () => {
        const file = join(profileRoot, 'aurora-file.m3u8');
        writeFileSync(file, '#EXTM3U\n');
        await electronApp.evaluate(({ dialog }, filePath) => {
            (dialog as any).showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filePath],
            });
        }, file);
        if (await mainWindow.locator('.library-playlists').isVisible())
            await mainWindow.locator('.library-playlists').click();
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        await mainWindow
            .getByRole('menuitem', { name: 'Adicionar via upload de arquivo' })
            .click();
        await mainWindow.locator('app-file-upload .file-upload').click();
        await expect(
            mainWindow
                .locator('mat-snack-bar-container')
                .filter({ hasText: 'Catálogo vazio' })
        ).toBeVisible();
        await expect(mainWindow.locator('app-file-upload')).toBeVisible();
        await mainWindow
            .getByRole('button', { name: 'Fechar', exact: true })
            .click();
        writeFileSync(file, syntheticCatalog());
        await mainWindow.locator('app-file-upload .file-upload').click();
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(36);
        await mainWindow
            .locator('[data-test-id="channel-item"]')
            .first()
            .click();
        await expect
            .poll(
                () =>
                    mainWindow.evaluate(() => {
                        const v = document.querySelector('video');
                        return !!v && v.currentTime > 0 && !v.error;
                    }),
                { timeout: 30000 }
            )
            .toBe(true);
        await mainWindow
            .getByRole('button', { name: 'Voltar ao catálogo' })
            .click();
        await mainWindow
            .locator('.library-rail-links')
            .getByRole('button', { name: 'Histórico', exact: true })
            .click();
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(1);
        await mainWindow.reload();
        await mainWindow
            .locator('.library-rail-links')
            .getByRole('button', { name: 'Histórico', exact: true })
            .click();
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(1);
    });

    test('imports a synthetic Xtream account and browses categories, movies, series and seasons through the UI', async () => {
        await mainWindow.evaluate(() => {
            const original = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return original.call(this);
            };
        });
        if (await mainWindow.locator('.library-playlists').isVisible())
            await mainWindow.locator('.library-playlists').click();
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        await mainWindow
            .getByRole('menuitem', { name: 'Adicionar Código Xtreme' })
            .click();
        const form = mainWindow.locator('app-xtream-code-import');
        await form
            .locator('[formControlName="title"]')
            .fill('Aurora Xtream sintético');
        await form.locator('[formControlName="serverUrl"]').fill(fixtureUrl);
        await form.locator('[formControlName="username"]').fill('synthetic');
        await form.locator('[formControlName="password"]').fill('synthetic');
        await form.locator('button[type="submit"]').click();
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(
            12
        );
        // Movies have a persistent category sidebar, matching the live TV
        // layout: categories and their titles remain visible simultaneously.
        const movieSidebar = mainWindow.locator(
            '[data-test-id="vod-category-sidebar"]'
        );
        await expect(movieSidebar).toBeVisible();
        await expect(movieSidebar.locator('.category-item')).toHaveCount(1);
        await expect(movieSidebar.locator('.vod-all-categories')).toHaveAttribute(
            'aria-pressed', 'true'
        );
        await movieSidebar.locator('.category-item').first().click();
        await expect(movieSidebar.locator('.category-item.selected')).toBeVisible();
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(12);
        // The categories column stays mounted when switching back to All.
        await movieSidebar.locator('.vod-all-categories').click();
        await expect(movieSidebar.locator('.vod-all-categories')).toHaveAttribute(
            'aria-pressed', 'true'
        );
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(12);
        await mainWindow
            .getByRole('searchbox', { name: 'Pesquisar no catálogo' })
            .fill('Cinema Aurora 02');
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(
            1
        );
        await mainWindow
            .getByRole('searchbox', { name: 'Pesquisar no catálogo' })
            .fill('');
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-xtream-movies.png'),
        });
        await mainWindow.locator('app-grid-list mat-card').first().click();
        await expect(mainWindow.locator('app-content-hero h1')).toHaveText(
            'Horizonte Aurora'
        );
        await expect(mainWindow.locator('.cast-member')).toHaveCount(2);
        const portrait = await mainWindow.locator('.cast-avatar').first().boundingBox();
        expect(portrait!.width).toBeGreaterThanOrEqual(90);
        expect(portrait!.height).toBeGreaterThanOrEqual(90);
        await mainWindow.locator('.cast-member').first().click();
        await expect(mainWindow.locator('.actor-filmography')).toBeVisible();
        await expect(mainWindow.locator('.actor-filmography h3')).toContainText(
            'Artista Aurora A'
        );
        await mainWindow.getByRole('button', { name: 'Fechar filmografia' }).click();
        await expect(mainWindow.locator('.actor-filmography')).toHaveCount(0);
        for (const [width, height] of [
            [1366, 768],
            [1920, 1080],
        ]) {
            await mainWindow.setViewportSize({ width, height });
            await mainWindow.screenshot({
                path: join(
                    screenshotDir,
                    `aurora-xtream-movie-details-${width}.png`
                ),
            });
            // Synopsis, tags and playback buttons must stay together in the
            // top half of the desktop view, not be pushed below the fold.
            const actions = await mainWindow
                .locator('app-content-hero .action-buttons')
                .boundingBox();
            const poster = await mainWindow
                .locator('app-content-hero .poster__image')
                .boundingBox();
            expect(actions).not.toBeNull();
            expect(actions!.y + actions!.height).toBeLessThan(height * 0.78);
            expect(poster!.height).toBeLessThan(height * 0.62);
        }
        await mainWindow.locator('app-content-hero .download-btn').click();
        await expect(
            mainWindow.locator('app-content-hero .download-btn')
        ).toContainText('Reproduzir download');
        await mainWindow.locator('app-content-hero .play-btn').first().click();
        await expect
            .poll(
                () =>
                    mainWindow
                        .locator('mat-dialog-content video')
                        .evaluate(
                            (v) =>
                                (v as HTMLVideoElement).currentTime > 0 &&
                                !(v as HTMLVideoElement).error
                        ),
                { timeout: 30000 }
            )
            .toBe(true);
        await expect(mainWindow.locator('.aurora-player-actions')).toHaveCount(0);
        await mainWindow.getByRole('button', { name: 'Fechar player' }).click();
        await mainWindow
            .getByRole('button', { name: 'Voltar ao catálogo', exact: true })
            .click();
        const seriesTab = mainWindow
            .locator('app-navigation')
            .getByRole('button', { name: 'Séries', exact: true });
        await seriesTab.click();
        await expect(seriesTab).toHaveAttribute('aria-pressed', 'true');
        const seriesSidebar = mainWindow.locator(
            '[data-test-id="vod-category-sidebar"]'
        );
        await expect(seriesSidebar).toBeVisible();
        await expect(seriesSidebar.locator('.category-item')).toHaveCount(1);
        // Clicking a series category must not replace the category column.
        await seriesSidebar.locator('.category-item').first().click();
        await expect(seriesSidebar.locator('.category-item.selected')).toBeVisible();
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(12);
        await expect(seriesSidebar).toBeVisible();
        await seriesSidebar.locator('.vod-all-categories').click();
        // Switching between movie and series tabs must not reuse the old
        // category ID or stale card data.
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(12);
        await expect(
            mainWindow.locator('app-grid-list mat-card').first()
        ).toContainText('Jornada Aurora');
        await mainWindow.locator('app-grid-list mat-card').first().click();
        await expect(mainWindow.locator('.season-card')).toHaveCount(2);
        await expect(mainWindow.locator('.episode-card')).toHaveCount(18);
        await mainWindow
            .getByRole('button', { name: 'Próximos episódios' })
            .first()
            .click();
        await expect
            .poll(() =>
                mainWindow
                    .locator('.episode-row')
                    .first()
                    .evaluate((el) => el.scrollLeft)
            )
            .toBeGreaterThan(0);
        await mainWindow.locator('.season-card').nth(1).click();
        await mainWindow.locator('.season-card').first().click();
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-xtream-episodes.png'),
        });
        await mainWindow.locator('.episode-play').first().click();
        await expect
            .poll(
                () =>
                    mainWindow
                        .locator('mat-dialog-content video')
                        .evaluate(
                            (v) =>
                                (v as HTMLVideoElement).currentTime > 0 &&
                                !(v as HTMLVideoElement).error
                        ),
                { timeout: 30000 }
            )
            .toBe(true);
        await expect(mainWindow.locator('.aurora-player-actions')).toHaveCount(0);
        await mainWindow.getByRole('button', { name: 'Fechar player' }).click();
        await expect(mainWindow.locator('.season-card')).toHaveCount(2);
        await mainWindow
            .getByRole('button', { name: 'Voltar ao catálogo', exact: true })
            .click();
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(
            12
        );

        // Live categories and channels must stay mounted side by side.
        await mainWindow.locator('app-navigation')
            .getByRole('button', { name: 'TV ao vivo', exact: true }).click();
        await expect(mainWindow.locator('.category-sidebar app-category-view')).toBeVisible();
        await expect(mainWindow.locator('.channels-sidebar')).toBeVisible();
        await mainWindow.locator('.category-sidebar .category-item').first().click();
        await expect(mainWindow.locator('.channels-sidebar app-portal-channels-list'))
            .toBeVisible();
        const categoriesBounds = await mainWindow.locator('.category-sidebar').boundingBox();
        const channelsBounds = await mainWindow.locator('.channels-sidebar').boundingBox();
        expect(categoriesBounds!.x + categoriesBounds!.width).toBeLessThanOrEqual(
            channelsBounds!.x + 2
        );
        await expect(mainWindow.locator('.category-sidebar .category-item').first())
            .toBeVisible();
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-live-three-columns.png')
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

    test('loads a large M3U with progress and bounded catalog rendering', async () => {
        await mainWindow.evaluate(() => {
            location.hash = '#/';
        });
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        await mainWindow
            .getByRole('menuitem', { name: 'Adicionar via URL' })
            .click();
        await mainWindow
            .locator('app-url-upload input')
            .fill(fixtureUrl + '/large.m3u');
        const started = Date.now();
        await mainWindow
            .locator('app-url-upload button[type="submit"]')
            .click();
        await expect(
            mainWindow.locator('[data-test-id="playlist-loading"]')
        ).toBeVisible();
        await expect(
            mainWindow.locator('[data-test-id="channel-item"]')
        ).toHaveCount(200);
        console.log(
            `Synthetic 20,100-item import and first render: ${Date.now() - started} ms`
        );
        await mainWindow
            .locator('.library-rail-links')
            .getByRole('button', { name: 'Filmes', exact: true })
            .click();
        await expect(
            mainWindow.locator('.poster-grid [data-test-id="channel-item"]')
        ).toHaveCount(100);
    });

    test('opens the full movie and series API from a get.php URL that contains only live channels', async () => {
        await mainWindow.evaluate(() => {
            location.hash = '#/';
        });
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        await mainWindow
            .getByRole('menuitem', { name: 'Adicionar via URL' })
            .click();
        await mainWindow
            .locator('app-url-upload input')
            .fill(
                fixtureUrl +
                    '/get.php?username=synthetic&password=synthetic&type=m3u_plus'
            );
        await mainWindow
            .locator('app-url-upload button[type="submit"]')
            .click();
        await expect(mainWindow).toHaveURL(/\/xtreams\//);
        for (const label of ['Filmes', 'Séries']) {
            await mainWindow
                .locator('app-navigation')
                .getByRole('button', { name: label, exact: true })
                .click();
            await expect(
                mainWindow.locator('app-grid-list mat-card')
            ).toHaveCount(12);
        }
    });

    test('migrates a previously saved get.php M3U without requiring reimport', async () => {
        await mainWindow.evaluate(async (base) => {
            const playlist = await window.electron.fetchPlaylistByUrl(
                base + '/catalog.m3u',
                'Lista anterior'
            );
            playlist._id = 'saved-get-php-migration';
            playlist.url =
                base + '/get.php?username=synthetic&password=synthetic';
            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.open('iptv-aurora-expert');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction(
                        'playlists',
                        'readwrite'
                    );
                    transaction.objectStore('playlists').put(playlist);
                    transaction.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                };
            });
            location.hash = '#/playlists/' + playlist._id;
        }, fixtureUrl);
        await expect(mainWindow).toHaveURL(
            /\/xtreams\/saved-get-php-migration/
        );
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(
            12
        );
        await mainWindow.reload();
        await expect(mainWindow.locator('app-grid-list mat-card')).toHaveCount(
            12
        );
    });

    test('organises settings, saves preferences across sections and fits dark and light layouts', async () => {
        await mainWindow.evaluate(() => {
            location.hash = '#/settings';
        });
        await expect(
            mainWindow.locator('.settings-sidebar nav button')
        ).toHaveCount(6);
        const save = mainWindow.locator('[data-test-id="save-settings"]');
        await expect(save).toBeDisabled();
        for (const section of [
            'playback',
            'guide',
            'subtitles',
            'remote',
            'data',
            'general',
        ]) {
            await mainWindow
                .locator(`[data-test-id="settings-nav-${section}"]`)
                .click();
            await expect(
                mainWindow.locator(
                    `[data-test-id="settings-section-${section}"]`
                )
            ).toBeVisible();
            expect(
                await mainWindow.locator('.settings-content').innerText()
            ).not.toMatch(/SETTINGS\.[A-Z_]+/);
            await expect(save).toBeVisible();
        }
        await mainWindow
            .locator('[data-test-id="settings-nav-remote"]')
            .click();
        await mainWindow
            .getByRole('checkbox', { name: 'Controle remoto', exact: true })
            .check();
        await mainWindow.locator('#remoteControlPort').fill('0');
        await expect(save).toBeDisabled();
        await mainWindow.locator('#remoteControlPort').fill('8876');
        await mainWindow
            .getByRole('checkbox', { name: 'Controle remoto', exact: true })
            .uncheck();
        await mainWindow
            .locator('[data-test-id="settings-nav-subtitles"]')
            .click();
        await mainWindow
            .locator('input[formControlName="subtitleLanguage"]')
            .fill('pt');
        await mainWindow
            .locator('[data-test-id="settings-nav-general"]')
            .click();
        await mainWindow.locator('[data-test-id="select-theme"]').click();
        await mainWindow
            .getByRole('option', { name: 'Tema claro', exact: true })
            .click();
        await save.click();
        await expect(save).toBeDisabled();
        await mainWindow.setViewportSize({ width: 1366, height: 768 });
        await expect(mainWindow.locator('body')).not.toHaveClass(/dark-theme/);
        await mainWindow
            .locator('mat-snack-bar-container')
            .waitFor({ state: 'detached' });
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-settings-light-1366.png'),
        });
        await mainWindow.reload();
        await mainWindow
            .locator('[data-test-id="settings-nav-subtitles"]')
            .click();
        await expect(
            mainWindow.locator('input[formControlName="subtitleLanguage"]')
        ).toHaveValue('pt');
        await mainWindow
            .locator('[data-test-id="settings-nav-general"]')
            .click();
        await mainWindow.locator('[data-test-id="select-theme"]').click();
        await mainWindow
            .getByRole('option', { name: 'Tema escuro', exact: true })
            .click();
        await save.click();
        await expect(mainWindow.locator('body')).toHaveClass(/dark-theme/);
        await mainWindow
            .locator('mat-snack-bar-container')
            .waitFor({ state: 'detached' });
        for (const [width, height] of [
            [1366, 768],
            [1920, 1080],
            [980, 720],
            [620, 800],
        ]) {
            await mainWindow.setViewportSize({ width, height });
            const footer = await mainWindow
                .locator('.settings-footer')
                .boundingBox();
            expect(footer!.y + footer!.height).toBeLessThanOrEqual(height + 1);
            expect(
                await mainWindow.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await mainWindow.screenshot({
                path: join(screenshotDir, `aurora-settings-dark-${width}.png`),
            });
        }
        await mainWindow.setViewportSize({ width: 1366, height: 768 });
        await mainWindow.locator('[data-test-id="back-to-home"]').click();
        await mainWindow.locator('[data-test-id="add-playlist"]').click();
        await mainWindow
            .getByRole('menuitem', { name: 'Importar do texto' })
            .click();
        await mainWindow
            .locator('app-text-import textarea')
            .fill(
                `#EXTM3U\n#EXTINF:-1 group-title="TV",Configuração em diálogo\n${fixtureUrl}/fixture.ts\n`
            );
        await mainWindow
            .locator('app-text-import button[type="submit"]')
            .click();
        await mainWindow
            .locator('.library-rail-links')
            .getByRole('button', { name: 'Menu', exact: true })
            .click();
        await mainWindow
            .getByRole('menuitem', { name: 'Configurações de reprodução' })
            .click();
        const modal = mainWindow.locator(
            '.mat-mdc-dialog-container [data-test-id="settings-container"]'
        );
        await expect(modal).toBeVisible();
        await expect(mainWindow.locator('.mat-mdc-menu-panel')).toBeHidden();
        await expect
            .poll(() =>
                modal
                    .locator('..')
                    .evaluate(
                        (el) =>
                            el
                                .getAnimations({ subtree: true })
                                .filter(
                                    (animation) =>
                                        animation.playState === 'running'
                                ).length
                    )
            )
            .toBe(0);
        expect((await modal.boundingBox())!.width).toBeGreaterThan(800);
        expect(
            await modal
                .locator('.settings-content')
                .evaluate((el) => el.scrollWidth <= el.clientWidth)
        ).toBe(true);
        const modalSave = await modal
            .locator('[data-test-id="save-settings"]')
            .boundingBox();
        expect(modalSave!.y + modalSave!.height).toBeLessThanOrEqual(769);
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-settings-dialog.png'),
        });
        await modal.locator('[data-test-id="back-to-home"]').click();
        await expect(
            mainWindow.locator('[data-test-id="add-playlist"]')
        ).toBeVisible();
    });

    test('checks and downloads a verified update through installed settings', async () => {
        test.skip(
            !process.env.AURORA_E2E_EXECUTABLE ||
                !process.env.AURORA_E2E_UPDATE_INSTALLER,
            'Requires a packaged installer'
        );
        await mainWindow.evaluate(() => {
            location.hash = '#/settings';
        });
        await mainWindow.locator('[data-test-id="check-app-update"]').click();
        await expect(
            mainWindow.locator('[data-test-id="app-update-status"]')
        ).toContainText('versão mais recente');
        updateAvailable = true;
        await mainWindow.locator('[data-test-id="check-app-update"]').click();
        await expect(
            mainWindow.locator('[data-test-id="download-app-update"]')
        ).toBeVisible();
        await mainWindow
            .locator('[data-test-id="download-app-update"]')
            .click();
        await expect(
            mainWindow.locator('[data-test-id="install-app-update"]')
        ).toBeVisible({ timeout: 60000 });
        await mainWindow.screenshot({
            path: join(screenshotDir, 'aurora-update-ready.png'),
        });
        // This deliberately future fixture is downloaded and verified, never installed.
        await mainWindow.locator('[data-test-id="back-to-home"]').click();
        await expect(
            mainWindow.locator('[data-test-id="add-playlist"]')
        ).toBeVisible();
    });
});

import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import App from '../app';
import { rendererAppName, rendererAppPort } from '../constants';
import { FLOATING_PLAYER_MARKER } from './floating-player-identity';

export interface FloatingPlayerData {
    streamUrl: string;
    title: string;
    startTime?: number;
    subtitleUrl?: string | null;
    contentInfo?: Record<string, unknown>;
}

let floatingWindow: BrowserWindow | null = null;
let currentSession: FloatingPlayerData | null = null;

const validSource = (url: string) =>
    /^https?:\/\//i.test(url) && url.length < 8192;

function isFromPiP(event: Electron.IpcMainInvokeEvent): boolean {
    return Boolean(
        floatingWindow &&
            !floatingWindow.isDestroyed() &&
            event.sender.id === floatingWindow.webContents.id
    );
}

export function registerAuroraFloatingPlayer(): void {
    ipcMain.handle(
        'AURORA_PIP_OPEN',
        async (event, data: FloatingPlayerData): Promise<boolean> => {
            if (event.sender.id !== App.mainWindow?.webContents.id) {
                return false;
            }
            if (
                !data ||
                typeof data.streamUrl !== 'string' ||
                !validSource(data.streamUrl) ||
                typeof data.title !== 'string'
            ) {
                return false;
            }

            currentSession = {
                streamUrl: data.streamUrl,
                title: data.title.slice(0, 220),
                startTime:
                    typeof data.startTime === 'number' &&
                    Number.isFinite(data.startTime) &&
                    data.startTime >= 0
                        ? data.startTime
                        : 0,
                subtitleUrl:
                    typeof data.subtitleUrl === 'string' &&
                    validSource(data.subtitleUrl)
                        ? data.subtitleUrl
                        : null,
                contentInfo:
                    data.contentInfo && typeof data.contentInfo === 'object'
                        ? data.contentInfo
                        : undefined,
            };

            if (floatingWindow && !floatingWindow.isDestroyed()) {
                floatingWindow.focus();
                floatingWindow.webContents.send('AURORA_PIP_SOURCE_CHANGED');
                return true;
            }

            const workArea = screen.getDisplayMatching(
                App.mainWindow!.getBounds()
            ).workArea;
            const initialWidth = Math.min(660, workArea.width);
            const initialHeight = Math.min(420, workArea.height);
            const win = new BrowserWindow({
                title: 'IPTV AURORA EXPERT — Picture in Picture',
                width: initialWidth,
                height: initialHeight,
                minWidth: 200,
                minHeight: 140,
                x: Math.round(workArea.x + workArea.width - initialWidth - 24),
                y: Math.round(workArea.y + workArea.height - initialHeight - 24),
                show: false,
                frame: true,
                thickFrame: true,
                resizable: true,
                movable: true,
                maximizable: true,
                minimizable: true,
                fullscreenable: true,
                alwaysOnTop: false,
                autoHideMenuBar: true,
                backgroundColor: '#101318',
                webPreferences: {
                    contextIsolation: true,
                    backgroundThrottling: false,
                    autoplayPolicy: 'no-user-gesture-required',
                    preload: join(__dirname, 'main.preload.js'),
                    additionalArguments: [FLOATING_PLAYER_MARKER],
                },
            });
            floatingWindow = win;
            win.setMenuBarVisibility(false);
            win.setMenu(null);
            win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            win.on('closed', () => {
                if (floatingWindow === win) {
                    floatingWindow = null;
                    currentSession = null;
                }
            });
            win.once('ready-to-show', () => {
                if (!win.isDestroyed()) win.show();
            });

            try {
                if (App.isDevelopmentMode()) {
                    await win.loadURL(
                        `http://localhost:${rendererAppPort}/#/floating-player`
                    );
                } else {
                    await win.loadFile(
                        join(__dirname, '..', rendererAppName, 'index.html'),
                        { hash: '/floating-player' }
                    );
                }
            } catch {
                if (!win.isDestroyed()) win.close();
                return false;
            }
            return true;
        }
    );

    ipcMain.handle('AURORA_PIP_GET_STATE', (event) => {
        return isFromPiP(event) ? currentSession : null;
    });

    ipcMain.handle(
        'AURORA_PIP_SET_ALWAYS_ON_TOP',
        (event, enabled: boolean): boolean => {
            if (!isFromPiP(event)) return false;
            floatingWindow!.setAlwaysOnTop(enabled === true);
            return floatingWindow!.isAlwaysOnTop();
        }
    );

    ipcMain.handle(
        'AURORA_PIP_RETURN',
        (event, currentTime?: number): boolean => {
            if (!isFromPiP(event) || !currentSession) return false;
            const data = {
                ...currentSession,
                startTime:
                    typeof currentTime === 'number' &&
                    Number.isFinite(currentTime) &&
                    currentTime >= 0
                        ? currentTime
                        : currentSession.startTime,
            };
            const mainWindow = App.mainWindow;
            if (!mainWindow || mainWindow.isDestroyed()) return false;
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('AURORA_PIP_RETURN_TO_APP', data);
            floatingWindow?.close();
            return true;
        }
    );
}

import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { AppUpdateState } from 'shared-interfaces';
import { environment } from '../../environments/environment';

const RELEASE_FEED =
    'https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT/releases/latest/download';
let state: AppUpdateState = {
    phase: 'idle',
    currentVersion: environment.version,
    message: 'Verifique se existe uma nova versão.',
};
let initialized = false;
let checking: Promise<unknown> | undefined;

function publish(patch: Partial<AppUpdateState>): AppUpdateState {
    state = { ...state, ...patch };
    for (const win of BrowserWindow.getAllWindows())
        if (!win.isDestroyed()) win.webContents.send('APP_UPDATE_STATE', state);
    return state;
}
function failure(error: unknown): AppUpdateState {
    const code = (error as { code?: string })?.code;
    const message =
        code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
            ? 'Nenhuma atualização publicada está disponível. Tente novamente mais tarde.'
            : code === 'ERR_UPDATER_CHECKSUM_MISMATCH'
              ? 'O arquivo recebido não passou na verificação de integridade. Tente baixar novamente.'
              : 'Não foi possível atualizar. Verifique a conexão e tente novamente.';
    return publish({ phase: 'error', percent: undefined, message });
}

export default class UpdateEvents {
    static initAutoUpdateService(): void {
        if (initialized) return;
        initialized = true;
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;
        autoUpdater.allowDowngrade = false;
        autoUpdater.allowPrerelease = false;
        autoUpdater.disableWebInstaller = true;
        autoUpdater.disableDifferentialDownload = true;
        autoUpdater.logger = null;
        // Webpack replaces direct process.env.NODE_ENV reads at build time.
        // Read the actual process environment for isolated packaged QA runs.
        const isTest = Reflect.get(process.env, 'NODE_ENV') === 'test';
        const testFeed =
            isTest
                ? process.env.AURORA_UPDATE_TEST_FEED
                : undefined;
        // Test override is restricted to the local fixture server.
        const feed =
            testFeed && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(testFeed)
                ? testFeed
                : RELEASE_FEED;
        autoUpdater.setFeedURL({ provider: 'generic', url: feed });
        autoUpdater.on('checking-for-update', () =>
            publish({
                phase: 'checking',
                percent: undefined,
                message: 'Procurando atualizações…',
            })
        );
        autoUpdater.on('update-available', (info) =>
            publish({
                phase: 'available',
                availableVersion: info.releaseName || info.version,
                message: `Nova versão disponível: ${info.releaseName || info.version}.`,
            })
        );
        autoUpdater.on('update-not-available', () =>
            publish({
                phase: 'up-to-date',
                availableVersion: undefined,
                message: 'Você está usando a versão mais recente.',
            })
        );
        autoUpdater.on('download-progress', (info) =>
            publish({
                phase: 'downloading',
                percent: Math.max(0, Math.min(100, Math.round(info.percent))),
                message: 'Baixando atualização…',
            })
        );
        autoUpdater.on('update-downloaded', (info) =>
            publish({
                phase: 'ready',
                percent: 100,
                availableVersion: info.releaseName || info.version,
                message: 'Atualização pronta. Reinicie para instalar.',
            })
        );
        autoUpdater.on('error', failure);
        ipcMain.handle('APP_UPDATE_GET_STATE', () => state);
        ipcMain.handle('APP_UPDATE_CHECK', () => this.checkForUpdates());
        ipcMain.handle('APP_UPDATE_DOWNLOAD', () => this.download());
        ipcMain.handle('APP_UPDATE_INSTALL', () => {
            if (state.phase !== 'ready') return false;
            setImmediate(() => autoUpdater.quitAndInstall(false, true));
            return true;
        });
        if (app.isPackaged && !isTest) {
            setTimeout(() => void this.checkForUpdates(), 30000).unref();
            setInterval(
                () => void this.checkForUpdates(),
                4 * 60 * 60 * 1000
            ).unref();
        }
    }
    static async checkForUpdates(): Promise<AppUpdateState> {
        if (!app.isPackaged)
            return publish({
                phase: 'unsupported',
                message:
                    'A atualização pelo programa está disponível na versão instalada para Windows.',
            });
        if (state.phase === 'downloading' || state.phase === 'ready')
            return state;
        if (checking) {
            await checking;
            return state;
        }
        checking = autoUpdater.checkForUpdates().catch(failure);
        try {
            await checking;
        } finally {
            checking = undefined;
        }
        return state;
    }
    static async download(): Promise<AppUpdateState> {
        if (state.phase !== 'available') return state;
        publish({
            phase: 'downloading',
            percent: 0,
            message: 'Baixando atualização…',
        });
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            failure(error);
        }
        return state;
    }
}

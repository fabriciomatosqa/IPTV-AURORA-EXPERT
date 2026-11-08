import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import UpdateEvents from './update.events';

jest.mock('electron', () => ({
    app: { isPackaged: true },
    ipcMain: { handle: jest.fn() },
    BrowserWindow: { getAllWindows: () => [] },
}));
jest.mock('electron-updater', () => {
    const emitter = new (require('events').EventEmitter)();
    return {
        autoUpdater: Object.assign(emitter, {
            setFeedURL: jest.fn(),
            checkForUpdates: jest.fn(),
            downloadUpdate: jest.fn(),
            quitAndInstall: jest.fn(),
        }),
    };
});

describe('installed application updater', () => {
    let handlers: Map<string, (...args: unknown[]) => any>;
    beforeAll(() => {
        UpdateEvents.initAutoUpdateService();
        handlers = new Map((ipcMain.handle as jest.Mock).mock.calls);
    });
    afterEach(() => jest.clearAllMocks());
    const emit = (name: string, value?: unknown) =>
        (autoUpdater as unknown as EventEmitter).emit(name, value);

    it('checks once concurrently and keeps downloads explicit', async () => {
        let finish!: () => void;
        (autoUpdater.checkForUpdates as jest.Mock).mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                })
        );
        const first = UpdateEvents.checkForUpdates();
        const second = UpdateEvents.checkForUpdates();
        expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
        emit('update-available', {
            version: '2026.1108.1',
            releaseName: '0.0.081126-01',
        });
        finish();
        expect((await first).availableVersion).toBe('0.0.081126-01');
        await second;
        expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
        expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    });

    it('only offers installation after the verified download completes', async () => {
        expect(handlers.get('APP_UPDATE_INSTALL')!()).toBe(false);
        (autoUpdater.downloadUpdate as jest.Mock).mockImplementation(
            async () => {
                emit('download-progress', { percent: 42.4 });
                expect(handlers.get('APP_UPDATE_GET_STATE')!().percent).toBe(
                    42
                );
                emit('update-downloaded', { version: '2026.1108.1' });
            }
        );
        expect((await UpdateEvents.download()).phase).toBe('ready');
        expect(handlers.get('APP_UPDATE_INSTALL')!()).toBe(true);
        expect(handlers.get('APP_UPDATE_GET_STATE')!().message)
            .toContain('modo oculto');
        await new Promise((resolve) => setImmediate(resolve));
        // First argument: silent NSIS upgrade (without installation wizard).
        // Second: restart the already-installed application afterward.
        expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
    });

    it('blocks installation on checksum failure and reports safe errors', async () => {
        emit('update-available', { version: '2026.1108.1' });
        (autoUpdater.downloadUpdate as jest.Mock).mockRejectedValue({
            code: 'ERR_UPDATER_CHECKSUM_MISMATCH',
            message: 'private details',
        });
        const state = await UpdateEvents.download();
        expect(state.phase).toBe('error');
        expect(state.message).toContain('integridade');
        expect(state.message).not.toContain('private');
        expect(handlers.get('APP_UPDATE_INSTALL')!()).toBe(false);
    });
});

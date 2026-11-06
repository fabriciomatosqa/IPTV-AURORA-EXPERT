import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EpgProgram } from 'shared-interfaces';
import { EpgService } from './epg.service';

describe('EpgService Electron contracts', () => {
    let service: EpgService;
    let originalElectron: unknown;
    let api: { fetchEpg: jest.Mock; getChannelPrograms: jest.Mock };
    let snackBar: { open: jest.Mock };
    const program: EpgProgram = {
        channel: 'test-channel',
        title: 'Authorized test program',
        desc: null,
        category: null,
        start: '2026-11-06T10:00:00.000Z',
        stop: '2026-11-06T11:00:00.000Z',
    };

    beforeEach(() => {
        originalElectron = (globalThis as any).electron;
        api = {
            fetchEpg: jest.fn().mockResolvedValue({ success: true }),
            getChannelPrograms: jest.fn().mockResolvedValue([program]),
        };
        (globalThis as any).electron = api;
        snackBar = { open: jest.fn() };
        TestBed.configureTestingModule({
            providers: [
                EpgService,
                { provide: MatSnackBar, useValue: snackBar },
                {
                    provide: TranslateService,
                    useValue: { instant: (key: string) => key },
                },
            ],
        });
        service = TestBed.inject(EpgService);
    });

    afterEach(() => {
        (globalThis as any).electron = originalElectron;
        jest.restoreAllMocks();
    });

    it('ignores empty URLs and updates EPG availability after a successful fetch', async () => {
        service.fetchEpg(['', '  ', 'https://example.test/epg.xml']);
        await Promise.resolve();
        expect(api.fetchEpg).toHaveBeenCalledWith([
            'https://example.test/epg.xml',
        ]);
        expect(await firstValueFrom(service.epgAvailable$)).toBe(true);
        service.fetchEpg(['', ' ']);
        expect(api.fetchEpg).toHaveBeenCalledTimes(1);
    });

    it('reports backend failures and resets availability', async () => {
        api.fetchEpg.mockResolvedValue({
            success: false,
            message: 'Invalid XMLTV',
        });
        service.fetchEpg(['https://example.test/epg.xml']);
        await Promise.resolve();
        expect(await firstValueFrom(service.epgAvailable$)).toBe(false);
        expect(snackBar.open).toHaveBeenCalledWith(
            'Invalid XMLTV',
            'CLOSE',
            expect.any(Object)
        );
    });

    it('normalizes channel program dates and clears stale programs after errors', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        api.getChannelPrograms.mockResolvedValue([
            { ...program, start: '2026-11-06T07:00:00-03:00' },
        ]);
        service.getChannelPrograms('test-channel');
        await Promise.resolve();
        expect(await firstValueFrom(service.currentEpgPrograms$)).toEqual([
            program,
        ]);
        expect(await firstValueFrom(service.epgAvailable$)).toBe(true);
        api.getChannelPrograms.mockRejectedValue(new Error('Offline'));
        service.getChannelPrograms('test-channel');
        await Promise.resolve();
        expect(await firstValueFrom(service.currentEpgPrograms$)).toEqual([]);
        expect(await firstValueFrom(service.epgAvailable$)).toBe(false);
    });

    it('caches current programs for 60 seconds and supports explicit invalidation', async () => {
        const now = new Date('2026-11-06T10:30:00Z');
        jest.useFakeTimers({ now });
        try {
            expect(
                await firstValueFrom(
                    service.getCurrentProgramForChannel('test-channel')
                )
            ).toEqual(program);
            await firstValueFrom(
                service.getCurrentProgramForChannel('test-channel')
            );
            expect(api.getChannelPrograms).toHaveBeenCalledTimes(1);
            jest.setSystemTime(new Date(now.getTime() + 60001));
            await firstValueFrom(
                service.getCurrentProgramForChannel('test-channel')
            );
            expect(api.getChannelPrograms).toHaveBeenCalledTimes(2);
            service.clearCache();
            await firstValueFrom(
                service.getCurrentProgramForChannel('test-channel')
            );
            expect(api.getChannelPrograms).toHaveBeenCalledTimes(3);
        } finally {
            jest.useRealTimers();
        }
    });

    it('keeps successful channels when one channel fails in a batch', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.useFakeTimers({ now: new Date('2026-11-06T10:30:00Z') });
        try {
            api.getChannelPrograms.mockImplementation((channelId: string) =>
                channelId === 'offline'
                    ? Promise.reject(new Error('Offline'))
                    : Promise.resolve([program])
            );
            const result = await firstValueFrom(
                service.getCurrentProgramsForChannels([
                    'test-channel',
                    'offline',
                ])
            );
            expect(result.get('test-channel')).toEqual(program);
            expect(result.get('offline')).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});

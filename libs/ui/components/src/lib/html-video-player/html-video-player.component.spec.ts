import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DataService } from 'services';
import { Channel } from 'shared-interfaces';
import { HtmlVideoPlayerComponent } from './html-video-player.component';

describe('HtmlVideoPlayerComponent', () => {
    let component: HtmlVideoPlayerComponent;
    let fixture: ComponentFixture<HtmlVideoPlayerComponent>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let dataService: DataService;

    const TEST_CHANNEL: Channel = {
        id: '1234',
        url: 'http://test.ts',
        name: 'Test channel',
        group: {
            title: 'News group',
        },
        tvg: {
            id: 'tvg-1',
            name: 'Test TVG',
            url: '',
            logo: '',
            rec: '',
        },
        http: {
            referrer: '',
            'user-agent': 'localhost',
            origin: '',
        },
        radio: 'false',
    };

    beforeEach(waitForAsync(() => {
        const dataServiceMock = {
            sendIpcEvent: jest.fn().mockResolvedValue(undefined),
        };

        TestBed.configureTestingModule({
            imports: [HtmlVideoPlayerComponent, TranslateModule.forRoot()],
            providers: [{ provide: DataService, useValue: dataServiceMock }],
        }).compileComponents();
    }));

    beforeEach(() => {
        // jsdom does not implement media playback or TextTrackList events.
        jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
            () => undefined
        );
        jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
            () => undefined
        );
        jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(
            undefined
        );
        fixture = TestBed.createComponent(HtmlVideoPlayerComponent);
        component = fixture.componentInstance;
        dataService = TestBed.inject(DataService);
        Object.defineProperty(
            fixture.nativeElement.querySelector('video'),
            'textTracks',
            {
                configurable: true,
                value: { length: 0, addEventListener: jest.fn() },
            }
        );
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should call play channel function after input changes', () => {
        jest.spyOn(component, 'playChannel');
        jest.spyOn(global.console, 'error').mockImplementation(() => {
            /* empty */
        });
        component.ngOnChanges({
            channel: new SimpleChange(null, TEST_CHANNEL, true),
        });
        fixture.detectChanges();

        expect(component.playChannel).toHaveBeenCalledWith(TEST_CHANNEL);
    });

    it('should use Hls for proxied m3u8 urls', () => {
        const proxiedM3u8 =
            'http://127.0.0.1:50339/stream?url=' +
            encodeURIComponent(
                'http://provider.example/live/user/pass/12345.m3u8'
            );

        const playNativeSpy = jest
            .spyOn(component as any, 'playNative')
            .mockImplementation(() => undefined);

        component.playChannel({
            ...TEST_CHANNEL,
            url: proxiedM3u8,
        });

        expect(playNativeSpy).toHaveBeenCalledWith(
            proxiedM3u8,
            'application/x-mpegURL'
        );
    });

    it('should use native mp4 playback for proxied mp4 urls', () => {
        const proxiedMp4 =
            'http://127.0.0.1:50339/stream?url=' +
            encodeURIComponent(
                'http://provider.example/movie/user/pass/777.mp4'
            );

        const playNativeSpy = jest
            .spyOn(component as any, 'playNative')
            .mockImplementation(() => undefined);

        component.playChannel({
            ...TEST_CHANNEL,
            url: proxiedMp4,
        });

        expect(playNativeSpy).toHaveBeenCalledWith(proxiedMp4, 'video/mp4');
    });

    it('keeps the same audio graph when checking a second channel', () => {
        const analyser = {
            fftSize: 0,
            frequencyBinCount: 128,
            connect: jest.fn(),
            disconnect: jest.fn(),
            getByteTimeDomainData: jest.fn(),
        };
        const source = { connect: jest.fn(), disconnect: jest.fn() };
        const context = {
            state: 'running',
            destination: {},
            createMediaElementSource: jest.fn(() => source),
            createAnalyser: jest.fn(() => analyser),
            close: jest.fn().mockResolvedValue(undefined),
        };
        const original = Object.getOwnPropertyDescriptor(
            window,
            'AudioContext'
        );
        Object.defineProperty(window, 'AudioContext', {
            configurable: true,
            value: jest.fn(() => context),
        });
        try {
            (component as any).electronApi = { getStreamProxyPort: jest.fn() };
            (component as any).currentSourceUrl =
                'http://example.test/first.mp4';
            (component as any).startSilenceCheck();
            (component as any).currentSourceUrl =
                'http://example.test/second.mp4';
            (component as any).startSilenceCheck();

            expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
            expect(source.connect).toHaveBeenCalledWith(analyser);
            expect(analyser.connect).toHaveBeenCalledWith(context.destination);
        } finally {
            fixture.destroy();
            if (original) {
                Object.defineProperty(window, 'AudioContext', original);
            } else {
                delete (window as any).AudioContext;
            }
        }
        expect(source.disconnect).toHaveBeenCalledTimes(1);
        expect(context.close).toHaveBeenCalledTimes(1);
    });

    it.each(['channel change', 'destroy'])(
        'discards pending recovery after %s',
        async (action) => {
            let resolvePort!: (port: number) => void;
            const sourceUrl = 'http://example.test/first.mp4';
            (component as any).electronApi = {
                getStreamProxyPort: () =>
                    new Promise<number>((resolve) => {
                        resolvePort = resolve;
                    }),
            };
            (component as any).currentSourceUrl = sourceUrl;
            const recovery = (component as any).retryWithAudioTranscode(
                sourceUrl
            );
            const playNative = jest
                .spyOn(component as any, 'playNative')
                .mockImplementation(() => undefined);
            jest.spyOn(
                component as any,
                'resetVideoElement'
            ).mockImplementation(() => undefined);
            if (action === 'channel change') {
                component.playChannel({
                    ...TEST_CHANNEL,
                    url: 'http://example.test/second.mp4',
                });
                playNative.mockClear();
            } else {
                fixture.destroy();
            }
            resolvePort(50339);
            await recovery;

            expect(playNative).not.toHaveBeenCalled();
        }
    );

    it('removes document fullscreen listeners when destroyed', () => {
        const removeListener = jest.spyOn(document, 'removeEventListener');
        fixture.destroy();

        expect(removeListener).toHaveBeenCalledWith(
            'fullscreenchange',
            (component as any).updateFullscreenState
        );
        expect(removeListener).toHaveBeenCalledWith(
            'webkitfullscreenchange',
            (component as any).updateFullscreenState
        );
    });
});

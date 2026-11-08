import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StorageMap } from '@ngx-pwa/local-storage';
import { of } from 'rxjs';
import { VideoPlayer } from 'shared-interfaces';
import { WebPlayerViewComponent } from 'shared-portals';

describe('WebPlayerViewComponent playback fallbacks', () => {
    let fixture: ComponentFixture<WebPlayerViewComponent>;
    let component: WebPlayerViewComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [WebPlayerViewComponent],
            providers: [
                {
                    provide: StorageMap,
                    useValue: {
                        get: jest.fn(() =>
                            of({
                                player: VideoPlayer.ArtPlayer,
                                showCaptions: false,
                            })
                        ),
                    },
                },
            ],
        })
            .overrideComponent(WebPlayerViewComponent, {
                set: { template: '' },
            })
            .compileComponents();

        fixture = TestBed.createComponent(WebPlayerViewComponent);
        component = fixture.componentInstance;
        (WebPlayerViewComponent as unknown as {
            pwaProxyBaseCache: string | null;
            pwaProbeInProgress: Promise<string | null> | null;
        }).pwaProxyBaseCache = null;
        (WebPlayerViewComponent as unknown as {
            pwaProbeInProgress: Promise<string | null> | null;
        }).pwaProbeInProgress = null;
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete (globalThis as { fetch?: typeof fetch }).fetch;
        delete (globalThis as any).electron;
    });

    it('forces the html5 fallback for proxied non-live streams', async () => {
        fixture.componentRef.setInput(
            'streamUrl',
            'http://localhost:3000/stream?url=' +
                encodeURIComponent(
                    'http://provider.example/movie/user/pass/77.mp4'
                )
        );
        fixture.detectChanges();

        await fixture.whenStable();

        expect(component.forceHtml5Fallback).toBe(true);
    });

    it('enables the videojs fallback after a live artplayer playback error', async () => {
        fixture.componentRef.setInput(
            'streamUrl',
            'http://provider.example/live/user/pass/414149.ts'
        );
        fixture.detectChanges();

        await fixture.whenStable();

        component.onArtPlayerPlaybackError();

        expect(component.forceVideoJsFallback).toBe(true);
    });

    it('proxies extensionless Xtream films and forwards provider headers', async () => {
        (globalThis as any).electron = {
            getStreamProxyPort: jest.fn().mockResolvedValue(34567),
        };
        fixture.componentRef.setInput('streamKind', 'vod');
        fixture.componentRef.setInput('streamHeaders', {
            userAgent: 'Aurora Test/1.0',
            referrer: 'https://referrer.example/',
            origin: 'https://origin.example',
        });
        fixture.componentRef.setInput(
            'streamUrl',
            'https://cdn.example/video?id=42'
        );
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.forceHtml5Fallback).toBe(true);
        const proxy = new URL(component.channel.url);
        expect(proxy.origin).toBe('http://127.0.0.1:34567');
        expect(proxy.pathname).toBe('/stream');
        expect(proxy.searchParams.get('url')).toBe(
            'https://cdn.example/video?id=42'
        );
        expect(proxy.searchParams.get('kind')).toBe('vod');
        expect(proxy.searchParams.get('ua')).toBe('Aurora Test/1.0');
        expect(proxy.searchParams.get('ref')).toBe('https://referrer.example/');
        expect(proxy.searchParams.get('org')).toBe('https://origin.example');
        delete (globalThis as any).electron;
    });

    it('builds an alternate m3u8 url for proxied live ts streams', () => {
        const proxiedTsUrl =
            'http://localhost:3000/stream?url=' +
            encodeURIComponent('http://provider.example/live/user/pass/414149.ts');

        const alternateUrl = (component as any).getAlternateLiveUrl(proxiedTsUrl);
        const parsed = new URL(alternateUrl);

        expect(parsed.origin).toBe('http://localhost:3000');
        expect(parsed.pathname).toBe('/stream');
        expect(parsed.searchParams.get('url')).toBe(
            'http://provider.example/live/user/pass/414149.m3u8'
        );
    });
});
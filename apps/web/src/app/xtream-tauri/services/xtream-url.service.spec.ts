import { TestBed } from '@angular/core/testing';
import { XtreamVodDetails } from 'shared-interfaces';
import { SettingsStore } from '../../services/settings-store.service';
import { XtreamUrlService } from './xtream-url.service';

describe('XtreamUrlService movie URLs', () => {
    let service: XtreamUrlService;
    const credentials = {
        serverUrl: 'http://iptv.example:8080/',
        username: 'test-user',
        password: 'test-pass',
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                XtreamUrlService,
                {
                    provide: SettingsStore,
                    useValue: { streamFormat: () => 'ts' },
                },
            ],
        });
        service = TestBed.inject(XtreamUrlService);
    });

    it('uses an explicit provider direct_source for video playback', () => {
        const item = {
            movie_data: {
                stream_id: 77,
                container_extension: 'mkv',
                direct_source: 'https://cdn.example/opaque?token=ok',
            },
        } as XtreamVodDetails;

        expect(service.constructVodUrl(credentials, item))
            .toBe('https://cdn.example/opaque?token=ok');
        expect(service.constructVodAlternateUrls(credentials, item))
            .toEqual([
                'http://iptv.example:8080/movie/test-user/test-pass/77.mkv',
            ]);
    });

    it('uses a canonical Xtream URL without double slashes when no direct source exists', () => {
        const item = {
            movie_data: {
                stream_id: 19,
                container_extension: 'mp4',
                direct_source: '',
            },
        } as XtreamVodDetails;

        expect(service.constructVodUrl(credentials, item))
            .toBe('http://iptv.example:8080/movie/test-user/test-pass/19.mp4');
        expect(service.constructVodAlternateUrls(credentials, item)).toEqual([]);
    });

    it('defaults missing or invalid container extensions to mp4', () => {
        const item = {
            movie_data: {
                stream_id: 51,
                container_extension: '',
                direct_source: '',
            },
        } as XtreamVodDetails;
        expect(service.constructVodUrl(credentials, item))
            .toBe('http://iptv.example:8080/movie/test-user/test-pass/51.mp4');
    });
});

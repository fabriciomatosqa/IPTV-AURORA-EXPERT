import { Overlay } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { StorageMap } from '@ngx-pwa/local-storage';
import { Observable, of } from 'rxjs';
import { DataService, PlaylistsService } from 'services';
import { Channel, PLAYLIST_PARSE_BY_URL } from 'shared-interfaces';
import { SettingsStore } from '../../services/settings-store.service';
import { VideoPlayerComponent } from './video-player.component';
import { ChannelActions } from 'm3u-state';

describe('VideoPlayerComponent playlist navigation', () => {
    let component: VideoPlayerComponent;
    let data: { sendIpcEvent: jest.Mock };
    let store: { select: jest.Mock; dispatch: jest.Mock };
    let route: {
        params: Observable<Record<string, string>>;
        queryParams: Observable<Record<string, string>>;
        snapshot: { queryParams: Record<string, string> };
    };
    const channels = [
        { name: 'First', url: 'https://example.test/first.m3u8' },
        { name: 'Second', url: 'https://example.test/second.m3u8' },
    ] as Channel[];

    beforeEach(() => {
        data = { sendIpcEvent: jest.fn() };
        store = {
            select: jest.fn().mockReturnValue(of(channels[0])),
            dispatch: jest.fn(),
        };
        route = {
            params: of({}),
            queryParams: of({}),
            snapshot: { queryParams: {} },
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: ActivatedRoute, useValue: route },
                { provide: DataService, useValue: data },
                { provide: MatDialog, useValue: { open: jest.fn() } },
                { provide: Overlay, useValue: {} },
                { provide: PlaylistsService, useValue: {} },
                { provide: Router, useValue: { navigate: jest.fn() } },
                {
                    provide: SettingsStore,
                    useValue: {
                        player: () => 'videojs',
                        showCaptions: () => false,
                    },
                },
                { provide: StorageMap, useValue: { get: () => of(undefined) } },
                { provide: Store, useValue: store },
            ],
        });
        component = TestBed.runInInjectionContext(
            () => new VideoPlayerComponent()
        );
    });

    afterEach(() => component.ngOnDestroy());

    it('imports an authorized URL as a temporary playlist', () => {
        route.snapshot.queryParams = { url: 'https://example.test/demo.m3u' };
        component.getPlaylistUrlAsParam();
        expect(data.sendIpcEvent).toHaveBeenCalledWith(PLAYLIST_PARSE_BY_URL, {
            url: 'https://example.test/demo.m3u',
            isTemporary: true,
        });
    });

    it('ignores malformed playlist URLs', () => {
        route.snapshot.queryParams = { url: 'javascript:alert(1)' };
        component.getPlaylistUrlAsParam();
        expect(data.sendIpcEvent).not.toHaveBeenCalled();
    });

    it('keeps an empty channel list for a route with no playlist', () => {
        component.ngOnInit();
        component.channels$.subscribe((value) => expect(value).toEqual([]));
    });

    it('selects numbered channels and ignores numbers outside the list', () => {
        component.channels$ = of(channels);
        component.switchToChannelByNumber(2);
        expect(store.dispatch).toHaveBeenCalledWith(
            ChannelActions.setActiveChannel({ channel: channels[1] })
        );
        store.dispatch.mockClear();
        component.switchToChannelByNumber(0);
        component.switchToChannelByNumber(3);
        expect(store.dispatch).not.toHaveBeenCalled();
    });
});

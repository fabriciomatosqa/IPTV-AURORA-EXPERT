import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectActivePlaylistId, selectAllPlaylistsMeta } from 'm3u-state';
import { PlaylistMeta } from 'shared-interfaces';
import { HomeComponent } from './home.component';
import { AddPlaylistDialogComponent } from '../shared/components/add-playlist/add-playlist-dialog.component';

describe('Aurora Home and playlists manager', () => {
    let component: HomeComponent;
    const dialog = { open: jest.fn() };
    const router = { navigate: jest.fn().mockResolvedValue(true) };
    const route = { snapshot: { data: {} as Record<string, boolean> } };
    const playlists = signal<PlaylistMeta[]>([]);
    const activeId = signal('m3u-1');
    const store = {
        selectSignal: jest.fn((selector: unknown) =>
            selector === selectAllPlaylistsMeta ? playlists : activeId
        ),
    };
    const fixtures = [
        { _id: 'm3u-1', title: 'M3U' },
        { _id: 'xtream-1', title: 'Xtream', serverUrl: 'https://provider.example', username: 'example' },
        { _id: 'stalker-1', title: 'Stalker', macAddress: '00:00:00:00:00:00' },
    ] as PlaylistMeta[];

    beforeEach(() => {
        dialog.open.mockClear();
        router.navigate.mockClear();
        store.selectSignal.mockClear();
        localStorage.removeItem('aurora-home-selected-playlist');
        route.snapshot.data = {};
        playlists.set([...fixtures]);
        activeId.set('m3u-1');
        TestBed.configureTestingModule({
            providers: [
                { provide: MatDialog, useValue: dialog },
                { provide: Router, useValue: router },
                { provide: ActivatedRoute, useValue: route },
                { provide: Store, useValue: store },
            ],
        });
        component = TestBed.runInInjectionContext(() => new HomeComponent());
    });

    it('opens the dashboard on startup and keeps list management at /listas', () => {
        expect(component.isPlaylistManager).toBe(false);
        expect(component.selectedPlaylist()?._id).toBe('m3u-1');
        component.openPlaylists();
        expect(router.navigate).toHaveBeenCalledWith(['/listas']);
        route.snapshot.data = { playlistManager: true };
        const manager = TestBed.runInInjectionContext(() => new HomeComponent());
        expect(manager.isPlaylistManager).toBe(true);
    });

    it('uses the selected M3U playlist and opens each content category', () => {
        for (const section of ['live', 'movies', 'series', 'favorites'] as const) {
            component.openSection(section);
            expect(router.navigate).toHaveBeenLastCalledWith(
                ['/playlists', 'm3u-1'],
                { queryParams: { section } }
            );
        }
    });

    it('routes Xtream and Stalker shortcuts to their existing screens', () => {
        component.selectPlaylist('xtream-1');
        expect(localStorage.getItem('aurora-home-selected-playlist')).toBe('xtream-1');
        component.openSection('movies');
        expect(router.navigate).toHaveBeenLastCalledWith(['/xtreams', 'xtream-1', 'vod']);
        component.openSection('favorites');
        expect(router.navigate).toHaveBeenLastCalledWith(['/xtreams', 'xtream-1', 'favorites']);
        component.selectPlaylist('stalker-1');
        component.openSection('live');
        expect(router.navigate).toHaveBeenLastCalledWith(['/stalker', 'stalker-1', 'itv']);
        component.openSection('series');
        expect(router.navigate).toHaveBeenLastCalledWith(['/stalker', 'stalker-1', 'series']);
        component.openSection('favorites');
        expect(router.navigate).toHaveBeenLastCalledWith(['/stalker', 'stalker-1', 'favorites']);
    });

    it('never opens deleted playlist IDs and redirects to lists if empty', () => {
        component.selectPlaylist('deleted-id');
        expect(component.selectedPlaylist()?._id).toBe('m3u-1');
        playlists.set([]);
        expect(component.selectedPlaylist()).toBeNull();
        component.openSection('live');
        expect(router.navigate).toHaveBeenLastCalledWith(['/listas']);
    });

    it('filters the management list and preserves existing import flow', () => {
        component.onSearchQueryChange('Aurora');
        expect(component.searchQuery()).toBe('Aurora');
        component.onSearchQueryChange('');
        expect(component.searchQuery()).toBe('');
        component.onAddPlaylist('url');
        expect(dialog.open).toHaveBeenCalledWith(AddPlaylistDialogComponent, {
            width: '600px', data: { type: 'url' },
        });
    });

    it('opens global search and recent content without changing their scope', () => {
        component.openGlobalSearch();
        expect(dialog.open).toHaveBeenLastCalledWith(expect.any(Function),
            expect.objectContaining({ data: { isGlobalSearch: true }, width: '100%' }));
        component.openGlobalRecent();
        expect(dialog.open).toHaveBeenLastCalledWith(expect.any(Function),
            expect.objectContaining({ data: { isGlobal: true }, hasBackdrop: true }));
    });
});

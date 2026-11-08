import { Component, computed, inject, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectActivePlaylistId, selectAllPlaylistsMeta } from 'm3u-state';
import { PlaylistMeta } from 'shared-interfaces';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistType, RecentPlaylistsComponent } from 'components';
import { AddPlaylistDialogComponent } from '../shared/components/add-playlist/add-playlist-dialog.component';
import { HeaderComponent } from '../shared/components/header/header.component';
import { GlobalRecentlyViewedComponent } from '../xtream-tauri/recently-viewed/global-recently-viewed.component';
import { GlobalSearchResultsComponent } from '../xtream-tauri/search-results/global-search-results.component';

type HomeSection = 'live' | 'movies' | 'series' | 'favorites';
const SELECTED_PLAYLIST_KEY = 'aurora-home-selected-playlist';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    imports: [HeaderComponent, RecentPlaylistsComponent, MatIcon, TranslatePipe],
})
export class HomeComponent {
    private readonly dialog = inject(MatDialog);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly store = inject(Store);

    /** The old list manager is still available at /listas, not on startup. */
    readonly isPlaylistManager = this.route.snapshot.data['playlistManager'] === true;
    readonly playlists = this.store.selectSignal(selectAllPlaylistsMeta);
    readonly activePlaylistId = this.store.selectSignal(selectActivePlaylistId);
    readonly preferredPlaylistId = signal(
        localStorage.getItem(SELECTED_PLAYLIST_KEY) || ''
    );
    /** Never open an unrelated route or stale/deleted playlist ID. */
    readonly selectedPlaylist = computed<PlaylistMeta | null>(() => {
        const playlists = this.playlists();
        return playlists.find(p => p._id === this.preferredPlaylistId()) ??
            playlists.find(p => p._id === this.activePlaylistId()) ??
            playlists[0] ?? null;
    });

    searchQuery = signal<string>('');

    selectPlaylist(id: string): void {
        if (!this.playlists().some(playlist => playlist._id === id)) return;
        this.preferredPlaylistId.set(id);
        localStorage.setItem(SELECTED_PLAYLIST_KEY, id);
    }

    openPlaylists(): void {
        void this.router.navigate(['/listas']);
    }

    openSection(section: HomeSection): void {
        const playlist = this.selectedPlaylist();
        if (!playlist) {
            this.openPlaylists();
            return;
        }
        if (playlist.macAddress) {
            const page = section === 'live' ? 'itv' : section === 'movies' ? 'vod' : section;
            void this.router.navigate(['/stalker', playlist._id, page]);
        } else if (playlist.serverUrl) {
            const page = section === 'movies' ? 'vod' : section;
            void this.router.navigate(['/xtreams', playlist._id, page]);
        } else {
            const page = section === 'movies' ? 'movies' : section;
            void this.router.navigate(['/playlists', playlist._id], {
                queryParams: { section: page },
            });
        }
    }

    onSearchQueryChange(query: string): void {
        this.searchQuery.set(query);
    }

    onAddPlaylist(playlistType: PlaylistType): void {
        this.dialog.open<AddPlaylistDialogComponent, { type: PlaylistType }>(
            AddPlaylistDialogComponent,
            {
                width: '600px',
                data: { type: playlistType },
            }
        );
    }

    openGlobalSearch(): void {
        this.dialog.open(GlobalSearchResultsComponent, {
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            panelClass: 'global-search-overlay',
            data: { isGlobalSearch: true },
        });
    }

    openGlobalRecent(): void {
        this.dialog.open(GlobalRecentlyViewedComponent, {
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            panelClass: 'global-search-overlay',
            data: { isGlobal: true },
            hasBackdrop: true,
            disableClose: false,
        });
    }
}

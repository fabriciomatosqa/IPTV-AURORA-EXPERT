import { Component, computed, inject, input, output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistInfoComponent } from 'components';
import { selectPlaylistById } from 'm3u-state';
import { Playlist } from 'shared-interfaces';
import { SettingsComponent } from '../../settings/settings.component';
import { AccountInfoComponent } from '../account-info/account-info.component';
import { XtreamStore } from '../stores/xtream.store';
import { NavigationItem } from './navigation.interface';

@Component({
    selector: 'app-navigation',
    imports: [
        MatIcon,
        MatMenuModule,
        RouterLink,
        RouterLinkActive,
        TranslatePipe,
    ],
    templateUrl: './navigation.component.html',
    styleUrl: './navigation.component.scss',
})
export class NavigationComponent {
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly dialog = inject(MatDialog);
    private readonly store = inject(Store);
    readonly xtreamStore = inject(XtreamStore, { optional: true });
    /** The same structural sidebar renders for M3U, Xtream and Stalker. */
    readonly mode = input<'portal' | 'm3u'>('portal');
    readonly epgRequested = output<void>();

    readonly portalStatus = input<'active' | 'inactive' | 'expired'>();
    readonly selectedContentType = input<string>();

    readonly categoryClick = output<string>();
    readonly pageClicked = output<
        'search' | 'recent' | 'favorites' | 'recently-added'
    >();

    readonly currentPlaylist = this.store.selectSignal(
        selectPlaylistById(this.activatedRoute.snapshot.params.id)
    );

    readonly isStalkerPlaylist = computed(
        () => (this.currentPlaylist() as Playlist)?.macAddress
    );

    readonly navigationItems = input<NavigationItem[]>();

    /** Check if running in Electron (downloads only available in desktop) */
    readonly isElectron = !!window.electron;

    getStatusColor(): string {
        if (this.isStalkerPlaylist()) return 'status-active';

        switch (this.portalStatus()) {
            case 'active':
                return 'status-active';
            case 'inactive':
                return 'status-inactive';
            case 'expired':
                return 'status-expired';
            default:
                return 'status-unavailable';
        }
    }

    getStatusIcon(): string {
        if (this.isStalkerPlaylist()) return 'play_circle';

        switch (this.portalStatus()) {
            case 'active':
                return 'check_circle';
            case 'inactive':
                return 'cancel';
            case 'expired':
                return 'warning';
            default:
                return 'error';
        }
    }

    openAccountInfo() {
        this.dialog.open(AccountInfoComponent, {
            width: '80%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            data: {
                vodStreamsCount: this.xtreamStore?.vodStreams().length ?? 0,
                liveStreamsCount: this.xtreamStore?.liveStreams().length ?? 0,
                seriesCount: this.xtreamStore?.serialStreams().length ?? 0,
            },
        });
    }

    openSettings() {
        // Keep settings modal within the actual viewport regardless of playlist
        // provider. The former M3U dialog already enforced these dimensions.
        this.dialog.open(SettingsComponent, {
            width: '1100px',
            maxWidth: '96vw',
            height: '88dvh',
            maxHeight: '92dvh',
            data: { isDialog: true },
        });
    }

    isContentTypeActive(type: string) {
        return this.selectedContentType() === type;
    }

    openPlaylistInfo() {
        this.dialog.open(PlaylistInfoComponent, {
            data: this.currentPlaylist(),
        });
    }

    pageSwitch(page: 'search' | 'recent' | 'favorites' | 'recently-added') {
        this.pageClicked.emit(page);
        this.xtreamStore?.setSelectedContentType(undefined);
    }
}

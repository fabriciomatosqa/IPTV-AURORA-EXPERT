import { AuroraCatalogNavigationComponent } from '../../shared/components/aurora-catalog-navigation/aurora-catalog-navigation.component';
import { DownloadsComponent } from '../../xtream-tauri/downloads/downloads.component';
import { catalogCategoryWidth } from '../../shared/utils/catalog-column-width';
import { isAdultContentLabel, moveAdultContentToEnd } from '../../shared/utils/adult-content-order';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { AsyncPipe, CommonModule } from '@angular/common';
import {
    Component,
    computed,
    HostListener,
    Injector,
    OnDestroy,
    OnInit,
    effect,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { StorageMap } from '@ngx-pwa/local-storage';
import {
    AudioPlayerComponent,
    ContentHeroComponent,
    COMPONENT_OVERLAY_REF,
    EpgListComponent,
    HtmlVideoPlayerComponent,
    InfoOverlayComponent,
    MultiEpgContainerComponent,
    ResizableDirective,
    PlaylistSwitcherComponent,
    SidebarComponent,
    ToolbarComponent,
    VjsPlayerComponent,
} from 'components';
import { PlaylistActions, ChannelActions, FavoritesActions, selectPlaylistTitle } from 'm3u-state';
import {
    selectActive,
    selectChannels,
    selectCurrentEpgProgram,
    selectFavorites,
} from 'm3u-state';
import {
    Observable,
    Subscription,
    combineLatest,
    combineLatestWith,
    filter,
    map,
    of,
    startWith,
    switchMap,
    take,
    tap,
    shareReplay,
    from,
    catchError,
    firstValueFrom,
} from 'rxjs';
import { DataService, PlaylistsService } from 'services';
import {
    Channel,
    Playlist,
    PLAYLIST_PARSE_BY_URL,
    STORE_KEY,
    Settings,
    SidebarView,
    VideoPlayer,
} from 'shared-interfaces';
import { SettingsStore } from '../../services/settings-store.service';
import {
    getAdjacentChannelItem,
    getChannelItemByNumber,
} from '../../shared/services/remote-channel-navigation.util';
import { SettingsComponent } from '../../settings/settings.component';
import {
    getExtensionFromUrl,
    getEpisodeIdentity,
    classifyCatalogChannel,
    buildCatalogIndex,
    emptyCatalogIndex,
    seriesKey,
    CatalogKind,
} from 'm3u-utils';
import { WebPlayerViewComponent } from 'shared-portals';

@Component({
    imports: [
        AsyncPipe,
        AudioPlayerComponent,
        ContentHeroComponent,
        CommonModule,
        AuroraCatalogNavigationComponent,
        DownloadsComponent,
        EpgListComponent,
        HtmlVideoPlayerComponent,
        InfoOverlayComponent,
        MatSidenavModule,
        MatIcon,
        MatMenuModule,
        ResizableDirective,
        PlaylistSwitcherComponent,
        RouterLink,
        SidebarComponent,
        ToolbarComponent,
        VjsPlayerComponent,
        WebPlayerViewComponent,
    ],
    templateUrl: './video-player.component.html',
    styleUrl: './video-player.component.scss',
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly dataService = inject(DataService);
    private readonly dialog = inject(MatDialog);
    private readonly overlay = inject(Overlay);
    private readonly playlistsService = inject(PlaylistsService);
    private readonly router = inject(Router);
    private readonly settingsStore = inject(SettingsStore);
    private readonly storage = inject(StorageMap);
    private readonly store = inject(Store);

    /** Active selected channel */
    readonly activeChannel$ = this.store
        .select(selectActive)
        .pipe(filter((channel) => Boolean((channel as Channel)?.url)));

    /** Channels list */
    channels$!: Observable<Channel[]>;

    readonly browsing = signal(true);
    readonly catalogChannels = signal<Channel[]>([]);
    readonly currentPlaylistTitle = this.store.selectSignal(selectPlaylistTitle);
    readonly catalogSection = signal('live');
    readonly catalogSearch = signal('');
    readonly catalogCategory = signal('');
    readonly categorySidebarQuery = signal('');
    readonly categorySearchOpen = signal(false);
    readonly catalogLimit = signal(200);
    readonly catalogSorted = signal(false);
    readonly catalogFavorites = this.store.selectSignal(selectFavorites);
    readonly catalogRecent = signal<string[]>([]);
    readonly catalogDetail = signal<Channel | null>(null);
    readonly catalogLoading = signal(true);
    readonly catalogProgress = signal(0);
    readonly catalogLoadError = signal('');
    readonly catalogIndex = signal(emptyCatalogIndex());
    private catalogGeneration = 0;
    private episodeInfo(
        channel: Channel
    ): { title: string; season: number; episode: number } | null {
        return (
            this.catalogIndex().episodes.get(channel.id) ||
            getEpisodeIdentity(channel.name)
        );
    }
    catalogItemTitle(channel: Channel): string {
        return this.catalogSection() === 'series'
            ? this.episodeInfo(channel)?.title || channel.name
            : channel.name;
    }
    readonly catalogDetailTitle = computed(() => {
        const item = this.catalogDetail();
        return item ? this.episodeInfo(item)?.title || item.name : '';
    });
    readonly catalogSeriesSeasons = computed(() => {
        const selected = this.catalogDetail();
        const identity = selected && this.episodeInfo(selected);
        if (!selected || !identity || this.contentKind(selected) !== 'series')
            return [];
        const seasons = new Map<number, Channel[]>();
        for (const channel of this.catalogIndex().seriesItems.get(
            seriesKey(selected, identity.title)
        ) || []) {
            const episode = this.episodeInfo(channel);
            if (
                episode?.title === identity.title &&
                channel.group?.title === selected.group?.title
            ) {
                const items = seasons.get(episode.season) || [];
                items.push(channel);
                seasons.set(episode.season, items);
            }
        }
        return [...seasons.entries()]
            .sort(([a], [b]) => a - b)
            .map(([season, episodes]) => ({
                season,
                episodes: episodes.sort(
                    (a, b) =>
                        this.episodeInfo(a)!.episode -
                        this.episodeInfo(b)!.episode
                ),
            }));
    });

    selectCatalogItem(channel: Channel): void {
        if (this.contentKind(channel) === 'live')
            this.playCatalogChannel(channel);
        else this.catalogDetail.set(channel);
    }
    readonly catalogNavigation = [
        { id: 'live', label: 'TV ao vivo', icon: 'tv' },
        { id: 'series', label: 'Séries', icon: 'video_library' },
        { id: 'movies', label: 'Filmes', icon: 'local_movies' },
        { id: 'downloads', label: 'Downloads', icon: 'download' },
    ];
    private contentKind(channel: Channel): string {
        return (
            this.catalogIndex().kinds.get(channel.id) ||
            classifyCatalogChannel(channel)
        );
    }
    readonly sectionChannels = computed(() => {
        const section = this.catalogSection();
        const channels = this.catalogChannels();
        if (section === 'favorites')
            return channels.filter((c) => this.isCatalogFavorite(c));
        if (section === 'recent') {
            const byId = new Map(channels.map((c) => [c.id, c]));
            return this.catalogRecent()
                .map((id) => byId.get(id))
                .filter((c): c is Channel => !!c);
        }
        return this.catalogIndex()[section as CatalogKind] || [];
    });
    readonly catalogCategories = computed(() =>
        moveAdultContentToEnd(
            [...new Set(this.sectionChannels().map(
                (c) => c.group?.title || 'Sem categoria'
            ))],
            isAdultContentLabel
        )
    );
    readonly auroraCategoryOptions = computed(() =>
        this.catalogCategories().map(title => ({
            id: title,
            title,
            count: this.catalogCategoryCounts().get(title) ?? 0,
        }))
    );
    readonly categorySidebarWidth = computed(() =>
        catalogCategoryWidth(this.catalogCategories().map((category) =>
            category + ' (' + (this.catalogCategoryCounts().get(category) || 0) + ')'
        ))
    );
    readonly catalogCategoryCounts = computed(() => {
        const counts = new Map<string, number>();
        for (const channel of this.sectionChannels()) {
            const category = channel.group?.title || 'Sem categoria';
            counts.set(category, (counts.get(category) ?? 0) + 1);
        }
        return counts;
    });
    readonly filteredCatalogCategories = computed(() => {
        const term = this.categorySidebarQuery().trim().toLocaleLowerCase();
        return term
            ? this.catalogCategories().filter((category) =>
                  category.toLocaleLowerCase().includes(term)
              )
            : this.catalogCategories();
    });
    selectCatalogCategory(category: string): void {
        this.catalogCategory.set(category);
        this.catalogLimit.set(200);
    }
    readonly filteredCatalog = computed(() => {
        const query = this.catalogSearch().trim().toLocaleLowerCase();
        const category = this.catalogCategory();
        const items = this.sectionChannels().filter(
            (c) =>
                (!category ||
                    (c.group?.title || 'Sem categoria') === category) &&
                (!query || c.name?.toLocaleLowerCase().includes(query))
        );
        const ordered = this.catalogSorted()
            ? [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            : items;
        return moveAdultContentToEnd(ordered, channel =>
            isAdultContentLabel(channel.group?.title) ||
            isAdultContentLabel(channel.name)
        );
    });
    readonly visibleCatalog = computed(() =>
        this.filteredCatalog().slice(0, this.catalogLimit())
    );

    changeCatalogSection(section: string): void {
        this.catalogDetail.set(null);
        this.catalogSection.set(section);
        this.catalogCategory.set('');
        this.categorySidebarQuery.set('');
        this.categorySearchOpen.set(false);
        this.catalogSearch.set('');
        this.catalogLimit.set(200);
        this.browsing.set(true);
    }

    isCatalogFavorite(channel: Channel): boolean {
        return (
            this.catalogFavorites().includes(channel.id) ||
            this.catalogFavorites().includes(channel.url)
        );
    }

    toggleCatalogFavorite(channel: Channel): void {
        this.store.dispatch(FavoritesActions.updateFavorites({ channel }));
    }

    playCatalogChannel(channel: Channel): void {
        this.catalogRecent.update((ids) =>
            [channel.id, ...ids.filter((id) => id !== channel.id)].slice(0, 100)
        );
        try {
            localStorage.setItem(
                this.catalogHistoryKey(),
                JSON.stringify(this.catalogRecent())
            );
        } catch {
            /* Playback does not depend on storage quota. */
        }
        this.store.dispatch(ChannelActions.setActiveChannel({ channel }));
        this.browsing.set(false);
    }

    private catalogHistoryKey(): string {
        return `aurora-m3u-history:${this.activatedRoute.snapshot.params['id'] || 'temporary'}`;
    }

    private async prepareCatalog(channels: Channel[]): Promise<Channel[]> {
        const generation = ++this.catalogGeneration;
        this.catalogLoading.set(true);
        this.catalogProgress.set(0);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const index = await buildCatalogIndex(
            channels,
            (progress) => {
                if (generation === this.catalogGeneration)
                    this.catalogProgress.set(progress);
            },
            () => generation !== this.catalogGeneration
        );
        if (generation === this.catalogGeneration) {
            this.catalogChannels.set(channels);
            this.catalogIndex.set(index);
            this.catalogLoading.set(false);
        }
        return channels;
    }

    /** Current epg program */
    readonly epgProgram$ = this.store.select(selectCurrentEpgProgram);

    /** Selected video player options */
    playerSettings: Partial<Settings> = {
        player: VideoPlayer.VideoJs,
        showCaptions: false,
    };

    readonly isDesktop = !!window['electron'];

    sidebarView: SidebarView = 'CHANNELS';

    /** EPG overlay reference */
    private overlayRef!: OverlayRef;
    private unsubscribeRemoteChannelChange?: () => void;
    private unsubscribeRemoteCommand?: () => void;
    private statusSubscription?: Subscription;
    private lastKnownVolume = 1;

    /** Info overlay component reference for manual triggering */
    readonly infoOverlay = viewChild(InfoOverlayComponent);

    /** Channel number input state */
    channelNumberInput = '';
    showChannelNumberOverlay = false;
    private channelNumberTimeout?: number;

    volume = 1;
    streamHeaders:
        | { userAgent?: string; referrer?: string; origin?: string }
        | undefined;

    constructor() {
        // Initialize volume from localStorage in constructor
        const savedVolume = localStorage.getItem('volume');
        if (savedVolume !== null) {
            this.volume = Number(savedVolume);
        }

        // React to settings changes
        effect(() => {
            this.playerSettings = {
                player: this.settingsStore.player(),
                showCaptions: this.settingsStore.showCaptions(),
            };
        });
    }

    /**
     * Sets video player and subscribes to channel list from the store
     */
    ngOnInit(): void {
        // Home shortcuts navigate directly to the selected playlist section.
        // Keep the existing live default for older navigation URLs.
        const section = this.activatedRoute.snapshot.queryParamMap?.get('section');
        if (section && ['live', 'movies', 'series', 'favorites'].includes(section)) {
            this.catalogSection.set(section);
        }
        try {
            const history = JSON.parse(
                localStorage.getItem(this.catalogHistoryKey()) || '[]'
            );
            if (Array.isArray(history))
                this.catalogRecent.set(
                    history.filter((id) => typeof id === 'string').slice(0, 100)
                );
        } catch {
            /* A damaged history must not prevent startup. */
        }
        this.applySettings();
        this.getPlaylistUrlAsParam();

        // Setup remote control channel change listener (Electron only)
        if (this.isDesktop && window.electron?.onChannelChange) {
            const unsubscribe = window.electron.onChannelChange(
                (data: { direction: 'up' | 'down' }) => {
                    this.handleRemoteChannelChange(data.direction);
                }
            );
            if (typeof unsubscribe === 'function') {
                this.unsubscribeRemoteChannelChange = unsubscribe;
            }
        }
        if (this.isDesktop && window.electron?.onRemoteControlCommand) {
            const unsubscribe = window.electron.onRemoteControlCommand(
                (command) => {
                    this.handleRemoteControlCommand(command);
                }
            );
            if (typeof unsubscribe === 'function') {
                this.unsubscribeRemoteCommand = unsubscribe;
            }
        }

        this.channels$ = this.activatedRoute.params
            .pipe(
                combineLatestWith(this.activatedRoute.queryParams),
                switchMap(([params, queryParams]) => {
                    if (params['id']) {
                        this.store.dispatch(
                            PlaylistActions.setActivePlaylist({
                                playlistId: params['id'],
                            })
                        );
                        return this.playlistsService
                            .getPlaylist(params['id'])
                            .pipe(
                                switchMap((playlist) =>
                                    from(
                                        this.resolveSavedProvider(
                                            playlist as Playlist
                                        )
                                    )
                                ),
                                filter(
                                    (playlist): playlist is Playlist =>
                                        !!playlist
                                ),
                                map((playlist) => {
                                    // Set user agent if specified on playlist level
                                    if (playlist.userAgent) {
                                        window.electron?.setUserAgent(
                                            playlist.userAgent,
                                            'localhost'
                                        );
                                    }

                                    this.streamHeaders = {
                                        userAgent: playlist.userAgent,
                                        referrer: playlist.referrer,
                                        origin: playlist.origin,
                                    };

                                    this.store.dispatch(
                                        ChannelActions.setChannels({
                                            channels: playlist.playlist.items,
                                        })
                                    );

                                    // Load favorites from the playlist
                                    if (
                                        playlist.favorites &&
                                        playlist.favorites.length > 0
                                    ) {
                                        this.store.dispatch(
                                            FavoritesActions.setFavorites({
                                                channelIds: playlist.favorites,
                                            })
                                        );
                                    } else {
                                        // Clear favorites if playlist has none
                                        this.store.dispatch(
                                            FavoritesActions.setFavorites({
                                                channelIds: [],
                                            })
                                        );
                                    }

                                    return playlist.playlist.items as Channel[];
                                })
                            );
                    } else if (queryParams['url']) {
                        return this.store.select(selectChannels) as Observable<
                            Channel[]
                        >;
                    }

                    // Ensure switchMap always returns an observable
                    // (e.g. /iptv route without params/query).
                    return of([] as Channel[]);
                })
            )
            .pipe(
                switchMap((channels) => from(this.prepareCatalog(channels))),
                catchError(() => {
                    this.catalogLoadError.set(
                        'Não foi possível abrir a lista salva. Volte ao início e tente novamente.'
                    );
                    this.catalogLoading.set(false);
                    return of([] as Channel[]);
                }),
                shareReplay({ bufferSize: 1, refCount: true })
            );

        this.statusSubscription = combineLatest([
            this.channels$,
            this.activeChannel$,
            this.epgProgram$.pipe(startWith(null)),
        ]).subscribe(([channels, activeChannel, epgProgram]) => {
            if (!window.electron?.updateRemoteControlStatus || !activeChannel) {
                return;
            }

            const currentIndex = channels.findIndex(
                (channel) => channel.url === activeChannel.url
            );

            window.electron.updateRemoteControlStatus({
                portal: 'm3u',
                isLiveView: true,
                channelName: activeChannel.name ?? activeChannel.tvg?.name,
                channelNumber: currentIndex >= 0 ? currentIndex + 1 : undefined,
                epgTitle: (epgProgram as any)?.title,
                epgStart: (epgProgram as any)?.start,
                epgEnd: (epgProgram as any)?.end,
                supportsVolume: true,
                volume: this.volume,
                muted: this.volume === 0,
            });
        });
    }

    /**
     * Handle remote control channel change
     */
    handleRemoteChannelChange(direction: 'up' | 'down'): void {
        console.log(`Remote control: changing channel ${direction}`);

        // Use combineLatest to get both values and take only the first emission
        combineLatest([this.channels$, this.activeChannel$])
            .pipe(
                filter(([channels, activeChannel]) => {
                    return channels.length > 0 && !!activeChannel;
                }),
                take(1),
                map(([channels, activeChannel]) => {
                    return {
                        channels,
                        activeChannel: activeChannel as Channel,
                    };
                })
            )
            .subscribe({
                next: ({ channels, activeChannel }) => {
                    const nextChannel = getAdjacentChannelItem(
                        channels,
                        activeChannel.url,
                        direction,
                        (channel) => channel.url
                    );

                    if (!nextChannel) {
                        return;
                    }

                    this.store.dispatch(
                        ChannelActions.setActiveChannel({
                            channel: nextChannel,
                        })
                    );
                },
                error: (err) => {
                    console.error('Error changing channel:', err);
                },
            });
    }

    private async resolveSavedProvider(
        playlist: Playlist
    ): Promise<Playlist | null> {
        let resolved = playlist;
        if (
            !playlist.serverUrl &&
            playlist.url &&
            window.electron?.resolveXtreamPlaylist
        ) {
            try {
                const url = new URL(playlist.url);
                if (
                    /\/get\.php$/i.test(url.pathname) &&
                    url.searchParams.has('username') &&
                    url.searchParams.has('password')
                ) {
                    const provider =
                        await window.electron.resolveXtreamPlaylist(
                            playlist.url,
                            playlist.title
                        );
                    if (provider) {
                        resolved = {
                            ...playlist,
                            serverUrl: provider.serverUrl,
                            username: provider.username,
                            password: provider.password,
                        };
                        await firstValueFrom(
                            this.playlistsService.updatePlaylist(
                                playlist._id,
                                resolved
                            )
                        );
                    }
                }
            } catch {
                /* An unavailable provider must not hide the locally saved M3U. */
            }
        }
        if (resolved.serverUrl && window.electron?.dbCreatePlaylist) {
            await window.electron.dbCreatePlaylist({
                id: resolved._id,
                name: resolved.title || '',
                serverUrl: resolved.serverUrl,
                username: resolved.username || '',
                password: resolved.password || '',
                type: 'xtream',
            });
            await this.router.navigate(['/xtreams', resolved._id], {
                replaceUrl: true,
            });
            return null;
        }
        return resolved;
    }

    ngOnDestroy(): void {
        this.catalogGeneration++;
        this.unsubscribeRemoteChannelChange?.();
        this.unsubscribeRemoteCommand?.();
        this.statusSubscription?.unsubscribe();
    }

    /**
     * Opens a playlist provided as a url param
     * e.g. iptvnat.or?url=http://...
     * @pwaOnly
     */
    getPlaylistUrlAsParam() {
        const URL_REGEX = /^(http|https|file):\/\/[^ "]+$/;
        const playlistUrl = this.activatedRoute.snapshot.queryParams['url'];

        if (playlistUrl && playlistUrl.match(URL_REGEX)) {
            this.dataService.sendIpcEvent(PLAYLIST_PARSE_BY_URL, {
                url: playlistUrl,
                isTemporary: true,
            });
        }
    }

    /**
     * Reads the app configuration from the browsers storage and applies the settings in the current component
     */
    applySettings(): void {
        this.storage.get(STORE_KEY.Settings).subscribe((settings: unknown) => {
            if (settings && Object.keys(settings as Settings).length > 0) {
                this.playerSettings = {
                    player:
                        (settings as Settings).player || VideoPlayer.VideoJs,
                    showCaptions: (settings as Settings).showCaptions || false,
                };
            }
        });
    }

    /**
     * Opens the overlay with multi EPG view
     */
    openMultiEpgView(): void {
        const positionStrategy = this.overlay
            .position()
            .global()
            .centerHorizontally()
            .centerVertically();

        this.overlayRef = this.overlay.create({
            hasBackdrop: true,
            positionStrategy,
            width: '100%',
            height: '100%',
        });

        const injector = Injector.create({
            providers: [
                {
                    provide: COMPONENT_OVERLAY_REF,
                    useValue: this.overlayRef,
                },
            ],
        });

        const portal = new ComponentPortal(
            MultiEpgContainerComponent,
            null,
            injector
        );

        const componentRef = this.overlayRef.attach(portal);
        componentRef.instance.playlistChannels = this.store.select(
            selectChannels
        ) as Observable<Channel[]>;

        // Pass the active channel's tvg.id for highlighting
        this.activeChannel$.pipe(take(1)).subscribe((channel) => {
            if (channel) {
                componentRef.instance.activeChannelId =
                    (channel as Channel).tvg?.id || null;
            }
        });

        this.overlayRef.backdropClick().subscribe(() => {
            this.overlayRef.dispose();
        });
    }

    openUrl(url: string) {
        window.open(url, '_blank');
    }

    navigateHome() {
        this.router.navigate(['/']);
    }

    openSettings() {
        this.dialog.open(SettingsComponent, {
            width: '1100px',
            maxWidth: '96vw',
            height: '88dvh',
            maxHeight: '92dvh',
            data: { isDialog: true },
        });
    }

    /**
     * Keyboard shortcut: Press 'I' to toggle EPG info overlay
     */
    @HostListener('document:keydown.i', ['$event'])
    handleInfoKeyPress(event: Event): void {
        // Don't trigger hotkeys when user is typing in input fields
        if (this.isTypingInInput(event)) {
            return;
        }
        // Prevent default behavior and show info overlay
        event.preventDefault();
        this.toggleInfoOverlay();
    }

    /**
     * Handle digit key presses for channel number input
     */
    @HostListener('document:keydown', ['$event'])
    handleKeyPress(event: KeyboardEvent): void {
        // Only handle digit keys (0-9)
        if (event.key >= '0' && event.key <= '9') {
            // Don't trigger hotkeys when user is typing in input fields
            if (this.isTypingInInput(event)) {
                return;
            }
            event.preventDefault();
            this.handleChannelNumberInput(event.key);
        }
    }

    /**
     * Toggles the EPG info overlay visibility
     * Called by 'I' keyboard shortcut or info button
     */
    toggleInfoOverlay(): void {
        const overlay = this.infoOverlay();
        if (overlay) {
            overlay.showOverlay();
        }
    }

    /**
     * Handle channel number input from keyboard
     * Debounces input to allow multi-digit channel numbers
     */
    handleChannelNumberInput(digit: string): void {
        // Clear existing timeout
        if (this.channelNumberTimeout) {
            clearTimeout(this.channelNumberTimeout);
        }

        // Add digit to current input
        this.channelNumberInput += digit;
        this.showChannelNumberOverlay = true;

        // Set timeout to switch channel after 2 seconds of no input
        this.channelNumberTimeout = window.setTimeout(() => {
            this.switchToChannelByNumber(parseInt(this.channelNumberInput, 10));
            this.clearChannelNumberInput();
        }, 2000);
    }

    /**
     * Switch to channel by number (1-based index)
     */
    switchToChannelByNumber(channelNumber: number): void {
        this.channels$
            .pipe(
                take(1),
                map((channels) =>
                    getChannelItemByNumber(channels, channelNumber)
                )
            )
            .subscribe((channel) => {
                if (channel) {
                    this.store.dispatch(
                        ChannelActions.setActiveChannel({ channel })
                    );
                }
            });
    }

    /**
     * Clear channel number input and hide overlay
     */
    clearChannelNumberInput(): void {
        this.channelNumberInput = '';
        this.showChannelNumberOverlay = false;
        if (this.channelNumberTimeout) {
            clearTimeout(this.channelNumberTimeout);
            this.channelNumberTimeout = undefined;
        }
    }

    /**
     * Check if the user is currently typing in an input or textarea field
     * @param event Keyboard event
     * @returns true if the event target is an input or textarea element
     */
    private isTypingInInput(event: Event): boolean {
        const target = event.target;
        return (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
        );
    }

    private handleRemoteControlCommand(command: {
        type:
            | 'channel-select-number'
            | 'volume-up'
            | 'volume-down'
            | 'volume-toggle-mute';
        number?: number;
    }): void {
        if (command.type === 'channel-select-number' && command.number) {
            this.switchToChannelByNumber(command.number);
            return;
        }

        if (command.type === 'volume-up') {
            this.setVolume(this.volume + 0.1);
        } else if (command.type === 'volume-down') {
            this.setVolume(this.volume - 0.1);
        } else if (command.type === 'volume-toggle-mute') {
            if (this.volume === 0) {
                this.setVolume(this.lastKnownVolume || 1);
            } else {
                this.lastKnownVolume = this.volume;
                this.setVolume(0);
            }
        }
    }

    private setVolume(next: number): void {
        const clamped = Math.max(0, Math.min(1, Number(next.toFixed(2))));
        this.volume = clamped;
        if (clamped > 0) {
            this.lastKnownVolume = clamped;
        }
        localStorage.setItem('volume', String(clamped));

        if (window.electron?.updateRemoteControlStatus) {
            window.electron.updateRemoteControlStatus({
                portal: 'm3u',
                isLiveView: true,
                supportsVolume: true,
                volume: this.volume,
                muted: this.volume === 0,
            });
        }
    }

    getVjsOptions(channel: Channel): {
        sources: Array<{ src: string; type?: string }>;
    } {
        if (channel.http?.['user-agent']) {
            window.electron?.setUserAgent(
                channel.http['user-agent'],
                channel.http.referrer
            );
        }

        const sourceUrl = this.buildChannelSourceUrl(channel);
        const extension = getExtensionFromUrl(
            this.getEffectiveSourceUrl(channel.url)
        )?.toLowerCase();

        if (extension === 'm3u8' || extension === 'm3u') {
            return {
                sources: [{ src: sourceUrl, type: 'application/x-mpegURL' }],
            };
        }

        if (extension === 'ts') {
            return {
                sources: [{ src: sourceUrl, type: 'video/mp2t' }],
            };
        }

        if (extension === 'mp4') {
            return {
                sources: [{ src: sourceUrl, type: 'video/mp4' }],
            };
        }

        return {
            sources: [{ src: sourceUrl }],
        };
    }

    private getEffectiveSourceUrl(url: string): string {
        try {
            const parsed = new URL(url);
            const nestedUrl = parsed.searchParams.get('url');
            return nestedUrl ? decodeURIComponent(nestedUrl) : url;
        } catch {
            return url;
        }
    }

    private buildChannelSourceUrl(channel: Channel): string {
        const extension = getExtensionFromUrl(
            this.getEffectiveSourceUrl(channel.url)
        )?.toLowerCase();
        const isVodLikeExtension = [
            'mp4',
            'mkv',
            'avi',
            'mov',
            'webm',
            'm4v',
            'mpeg',
            'mpg',
            'wmv',
            'flv',
        ].includes(extension ?? '');

        // EPG query params are intended for live streams and can break VOD playback.
        const epgParams = isVodLikeExtension ? '' : (channel.epgParams ?? '');
        return channel.url + epgParams;
    }
}

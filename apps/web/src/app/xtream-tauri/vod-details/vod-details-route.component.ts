import { Location, SlicePipe } from '@angular/common';
import {
    Component,
    OnDestroy,
    OnInit,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ContentHeroComponent } from 'components';
import { XtreamVodDetails } from 'shared-interfaces';
import { DownloadsService } from '../../services/downloads.service';
import { OpenSubtitlesService } from '../../services/opensubtitles.service';
import { SettingsStore } from '../../services/settings-store.service';
import { XtreamStore } from '../stores/xtream.store';
import { SafePipe } from '@iptvmate/pipes';
import { createLogger } from '../../shared/utils/logger';
import {
    ActorFilmographyService,
    ActorProfile,
    ActorWork,
} from '../services/actor-filmography.service';

/**
 * Route-based VOD details container for Xtream.
 *
 * This is a "smart" component that:
 * - Reads route params (vodId, categoryId)
 * - Fetches data via XtreamStore
 * - Manages playback and favorites
 *
 * Used for route-based navigation: /xtreams/:id/vod/:categoryId/:vodId
 */
@Component({
    templateUrl: './vod-details-route.component.html',
    styleUrls: ['../detail-view.scss'],
    imports: [
        ContentHeroComponent,
        MatIcon,
        SafePipe,
        SlicePipe,
        TranslateModule,
        MatProgressSpinnerModule,
    ],
})
export class VodDetailsRouteComponent implements OnInit, OnDestroy {
    private location = inject(Location);
    private readonly router = inject(Router);
    private readonly actorsService = inject(ActorFilmographyService);
    private settingsStore = inject(SettingsStore);
    private route = inject(ActivatedRoute);
    private readonly xtreamStore = inject(XtreamStore);
    private readonly downloadsService = inject(DownloadsService);
    private readonly openSubtitles = inject(OpenSubtitlesService);
    private readonly logger = createLogger('VodDetailsRoute');
    private detailsInitialized = false;

    readonly theme = this.settingsStore.theme;
    readonly isElectron = this.downloadsService.isAvailable;

    readonly isFavorite = this.xtreamStore.isFavorite;
    readonly selectedItem = this.xtreamStore.selectedItem;
    readonly isLoadingDetails = this.xtreamStore.isLoadingDetails;
    readonly detailsError = this.xtreamStore.detailsError;
    readonly showTrailer = signal(false);
    readonly castMembers = computed(() => {
        const info = this.selectedItem()?.info;
        const raw = info?.actors || info?.cast || '';
        return [...new Set(raw.split(',').map((v: string) => v.trim()).filter(Boolean))].slice(0, 40);
    });
    readonly actorProfiles = signal<Record<string, ActorProfile>>({});
    readonly missingPortraits = signal<string[]>([]);
    readonly selectedActor = signal<string | null>(null);
    readonly actorFilmography = signal<ActorWork[]>([]);
    readonly actorFilmographyLoading = signal(false);
    readonly actorLocalMatches = computed(() => {
        const actor = this.selectedActor()?.toLocaleLowerCase();
        if (!actor) return [] as Array<{
            title: string; kind: 'vod' | 'series';
            id: number; categoryId: number;
        }>;
        const titles = new Set(this.actorFilmography().map((w) =>
            this.normalizeTitle(w.title)
        ));
        const hits: Array<{
            title: string; kind: 'vod' | 'series';
            id: number; categoryId: number;
        }> = [];
        const current = this.selectedItem();
        if (current?.info?.name) {
            hits.push({
                title: current.info.name,
                kind: 'vod',
                id: Number(current.movie_data?.stream_id || this.route.snapshot.params.vodId),
                categoryId: Number(this.route.snapshot.params.categoryId),
            });
        }
        for (const item of this.xtreamStore.vodStreams()) {
            const title = item.name ?? '';
            if (title && titles.has(this.normalizeTitle(title)) &&
                !hits.some((hit) => hit.kind === 'vod' && hit.id === Number(item.stream_id))) {
                hits.push({
                    title, kind: 'vod', id: Number(item.stream_id),
                    categoryId: Number(item.category_id),
                });
            }
        }
        for (const item of this.xtreamStore.serialStreams()) {
            const title = item.name ?? '';
            const cast = (item.cast || '').toLocaleLowerCase();
            if (cast.split(',').some((name: string) => name.trim() === actor) ||
                (title && titles.has(this.normalizeTitle(title)))) {
                hits.push({
                    title, kind: 'series', id: Number(item.series_id),
                    categoryId: Number(item.category_id),
                });
            }
        }
        return hits.slice(0, 80);
    });

    readonly hasPlaybackPosition = computed(() => {
        const vodId = this.route.snapshot.params.vodId;
        const inProgress = this.xtreamStore.isInProgress(Number(vodId), 'vod');
        this.logger.debug('hasPlaybackPosition check', {
            vodId,
            inProgress,
        });
        return inProgress;
    });

    /** Check if VOD is already downloaded */
    readonly isDownloaded = computed(() => {
        const vodId = Number(this.route.snapshot.params.vodId);
        const playlistId = this.xtreamStore.currentPlaylist()?.id;
        if (!playlistId) return false;
        // Access downloads signal to make this reactive
        this.downloadsService.downloads();
        return this.downloadsService.isDownloaded(vodId, playlistId, 'vod');
    });

    /** Check if VOD is currently downloading */
    readonly isDownloading = computed(() => {
        const vodId = Number(this.route.snapshot.params.vodId);
        const playlistId = this.xtreamStore.currentPlaylist()?.id;
        if (!playlistId) return false;
        // Access downloads signal to make this reactive
        this.downloadsService.downloads();
        return this.downloadsService.isDownloading(vodId, playlistId, 'vod');
    });

    constructor() {
        effect(() => {
            const members = this.castMembers();
            // Fetch portrait metadata only for the current film.
            for (const name of members) {
                void this.actorsService.profile(name).then((profile) => {
                    if (!this.castMembers().includes(name)) return;
                    this.actorProfiles.update((state) => ({ ...state, [name]: profile }));
                });
            }
        });

        // Retry initialization when playlist becomes available.
        // This effect runs if ngOnInit deferred initialization due to missing playlist.
        effect(() => {
            if (this.detailsInitialized) return;
            const playlistId = this.xtreamStore.currentPlaylist()?.id;
            if (!playlistId) return;
            this.logger.debug(
                'Playlist now available, initializing VOD details'
            );
            this.initializeVodDetails(playlistId);
            this.detailsInitialized = true;
        });
    }

    ngOnInit(): void {
        const currentPlaylist = this.xtreamStore.currentPlaylist();
        if (!currentPlaylist?.id) {
            this.logger.warn('Deferring VOD details init: playlist not ready');
            return;
        }
        this.initializeVodDetails(currentPlaylist.id);
        this.detailsInitialized = true;
    }

    ngOnDestroy() {
        this.xtreamStore.setSelectedItem(null);
    }

    async playVod(vodItem: XtreamVodDetails) {
        this.addToRecentlyViewed();
        const streamUrl = this.xtreamStore.constructVodStreamUrl(vodItem);

        // Use route param vodId if available to match ngOnInit logic, otherwise fallback to item id
        const routeVodId = this.route.snapshot.params.vodId;
        const id = routeVodId
            ? Number(routeVodId)
            : Number(
                  vodItem.movie_data?.stream_id || (vodItem as any).stream_id
              );

        this.logger.debug('playVod resolved ID', { id });

        const contentInfo = {
            playlistId: this.xtreamStore.currentPlaylist().id,
            contentXtreamId: id,
            contentType: 'vod',
        };

        const subtitleUrl = vodItem.info?.tmdb_id
            ? await this.openSubtitles.fetchSubtitleUrl(
                  vodItem.info.tmdb_id,
                  undefined,
                  undefined,
                  undefined,
                  vodItem.info.name ?? vodItem?.movie_data?.name
              )
            : null;

        this.xtreamStore.openPlayer(
            streamUrl,
            vodItem.info.name ?? vodItem?.movie_data?.name,
            vodItem.info.movie_image,
            undefined,
            contentInfo,
            subtitleUrl
        );
    }

    async resumeVod(vodItem: XtreamVodDetails) {
        this.addToRecentlyViewed();
        const vodId = Number(this.route.snapshot.params.vodId);
        const position = this.xtreamStore
            .playbackPositions()
            .get(`vod_${vodId}`);
        const streamUrl = this.xtreamStore.constructVodStreamUrl(vodItem);

        // Use vodId from route (same as above)
        const contentInfo = {
            playlistId: this.xtreamStore.currentPlaylist().id,
            contentXtreamId: vodId,
            contentType: 'vod',
        };

        const subtitleUrl = vodItem.info?.tmdb_id
            ? await this.openSubtitles.fetchSubtitleUrl(
                  vodItem.info.tmdb_id,
                  undefined,
                  undefined,
                  undefined,
                  vodItem.info.name ?? vodItem?.movie_data?.name
              )
            : null;

        this.xtreamStore.openPlayer(
            streamUrl,
            vodItem.info.name ?? vodItem?.movie_data?.name,
            vodItem.info.movie_image,
            position?.positionSeconds,
            contentInfo,
            subtitleUrl
        );
    }

    formatPosition(): string {
        const vodId = Number(this.route.snapshot.params.vodId);
        const position = this.xtreamStore
            .playbackPositions()
            .get(`vod_${vodId}`);
        if (!position) return '';

        const date = new Date(0);
        date.setSeconds(position.positionSeconds);
        const timeString = date.toISOString().substr(11, 8);
        return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
    }

    toggleFavorite() {
        this.xtreamStore.toggleFavorite(
            this.route.snapshot.params.vodId,
            this.xtreamStore.currentPlaylist().id
        );
    }

    private addToRecentlyViewed() {
        this.xtreamStore.addRecentItem({
            contentId: this.route.snapshot.params.vodId,
            playlist: this.xtreamStore.currentPlaylist,
        });
    }

    private initializeVodDetails(playlistId: string): void {
        const { categoryId, vodId } = this.route.snapshot.params;
        this.xtreamStore.fetchVodDetailsWithMetadata({ vodId, categoryId });
        this.xtreamStore.checkFavoriteStatus(vodId, playlistId);
        this.xtreamStore.loadVodPosition(playlistId, Number(vodId));
    }

    goBack() {
        this.location.back();
    }

    actorPhoto(name: string): string | undefined {
        return this.missingPortraits().includes(name)
            ? undefined
            : this.actorProfiles()[name]?.photoUrl;
    }

    markPortraitUnavailable(name: string): void {
        this.missingPortraits.update((names) =>
            names.includes(name) ? names : [...names, name]
        );
    }

    async selectActor(name: string): Promise<void> {
        if (this.selectedActor() === name) {
            this.selectedActor.set(null);
            return;
        }
        this.selectedActor.set(name);
        this.actorFilmography.set([]);
        this.actorFilmographyLoading.set(true);
        const profile = await this.actorsService.profile(name);
        const works = await this.actorsService.filmography(profile.wikidataId);
        if (this.selectedActor() !== name) return;
        this.actorFilmography.set(works);
        this.actorFilmographyLoading.set(false);
    }

    openActorCatalogItem(item: {
        kind: 'vod' | 'series'; id: number; categoryId: number;
    }): void {
        const playlistId = this.xtreamStore.currentPlaylist()?.id;
        if (!playlistId) return;
        this.selectedActor.set(null);
        void this.router.navigate([
            '/xtreams', playlistId, item.kind,
            item.categoryId, item.id,
        ]);
    }

    private normalizeTitle(title: string): string {
        return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s*\(\d{4}\)\s*$/, '')
            .trim().toLocaleLowerCase();
    }

    async downloadVod(vodItem: XtreamVodDetails) {
        const streamUrl = this.xtreamStore.constructVodStreamUrl(vodItem);
        const routeVodId = this.route.snapshot.params.vodId;
        const id = routeVodId
            ? Number(routeVodId)
            : Number(
                  vodItem.movie_data?.stream_id || (vodItem as any).stream_id
              );

        const playlist = this.xtreamStore.currentPlaylist();

        await this.downloadsService.startDownload({
            playlistId: playlist.id,
            xtreamId: id,
            contentType: 'vod',
            title: vodItem.info?.name || vodItem?.movie_data?.name || 'Unknown',
            url: streamUrl,
            posterUrl: vodItem.info?.movie_image,
            headers: {
                userAgent: playlist.userAgent,
                referer: playlist.referrer,
                origin: playlist.origin,
            },
        });
    }

    async playFromLocal() {
        const vodId = Number(this.route.snapshot.params.vodId);
        const playlistId = this.xtreamStore.currentPlaylist()?.id;
        if (!playlistId) return;

        const filePath = this.downloadsService.getDownloadedFilePath(
            vodId,
            playlistId,
            'vod'
        );

        if (filePath) {
            await this.downloadsService.playDownload(filePath);
        }
    }
}

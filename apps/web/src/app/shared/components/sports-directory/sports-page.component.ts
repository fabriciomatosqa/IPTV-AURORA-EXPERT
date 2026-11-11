import { Component, computed, effect, inject, signal } from '@angular/core';
import { parseSportsBroadcasts, SportsBroadcast } from './sports-broadcast.model';
import { identifySport } from './sports-directory.model';
import { ActivatedRoute, Router } from '@angular/router';
import { StalkerStore } from '../../../stalker/stalker.store';
import { XtreamStore } from '../../../xtream-tauri/stores/xtream.store';
import { SportsDirectoryComponent } from './sports-directory.component';
import { SportsSource } from './sports-directory.model';

// Short-lived playlist-scoped guide index avoids rescanning all channels whenever
// a user leaves and returns to the Sports tab.
const sportsGuideCache = new Map<string, { checked: number; items: SportsBroadcast[] }>();
const SPORTS_GUIDE_TTL = 15 * 60 * 1000;
function rememberGuide(key: string, items: SportsBroadcast[]): void {
    sportsGuideCache.set(key, { checked: Date.now(), items });
    if (sportsGuideCache.size > 6)
        sportsGuideCache.delete(sportsGuideCache.keys().next().value!);
}

@Component({
    selector: 'app-sports-page',
    standalone: true,
    imports: [SportsDirectoryComponent],
    template: `<app-sports-directory
        [sources]="sportsCategories()"
        [loading]="isLoading()"
        [broadcasts]="broadcasts()"
        (watch)="watchBroadcast($event)"
        (chosen)="openCompetition($event)" />`,
    styles: [':host { display: block; height: 100%; width: 100%; min-width: 0; overflow: hidden; }'],
})
export class SportsPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly xtream = inject(XtreamStore, { optional: true });
    private readonly stalker = inject(StalkerStore, { optional: true });
    readonly provider = this.route.snapshot.data['provider'] as 'xtream' | 'stalker';
    readonly broadcasts = signal<SportsBroadcast[]>([]);
    private epgRequestedFor = '';
    private epgGeneration = 0;

    readonly sportsCategories = computed<SportsSource[]>(() => {
        if (this.provider === 'stalker') {
            return (this.stalker?.getCategoryResource() || []).filter(category =>
                category.category_id !== '*'
            ).map(category => ({
                id: String(category.category_id),
                title: category.category_name || '',
            }));
        }
        return (this.xtream?.liveCategories() || []).map(category => {
            // Categories read from SQLite and those fetched from Xtream APIs
            // use different property names; preserve the original provider ID.
            const source = category as {
                id?: number | string;
                category_id?: number | string;
                name?: string;
                category_name?: string;
            };
            return {
                id: String(source.category_id ?? source.id ?? ''),
                title: source.category_name ?? source.name ?? '',
            };
        });
    });

    readonly isLoading = computed(() => this.provider === 'stalker'
        ? !!this.stalker?.isCategoryResourceLoading()
        : !!this.xtream?.isLoadingCategories()
    );

    constructor() {
        // Stalker loads live categories lazily. Entering Sports must fetch its
        // actual live category list; never display movies as competitions.
        if (this.provider === 'stalker') {
            this.stalker?.setSelectedContentType('itv');
        }
        effect(() => {
            if (this.provider === 'xtream') {
                const playlist = this.xtream?.currentPlaylist();
                const content = this.xtream?.liveStreams() || [];
                const key = String(playlist?.id || '') + ':' + content.length;
                if (this.epgRequestedFor !== 'xtream:' + key) {
                    this.epgRequestedFor = 'xtream:' + key;
                    this.epgGeneration++;
                    this.broadcasts.set([]);
                    if (playlist && content.length) void this.loadXtreamSportsEpg('xtream:' + key);
                }
            } else {
                const playlist = this.stalker?.currentPlaylist();
                const content = this.stalker?.itvChannels() || [];
                const key = String(playlist?._id || '') + ':' + content.length;
                if (this.epgRequestedFor !== 'stalker:' + key) {
                    this.epgRequestedFor = 'stalker:' + key;
                    this.epgGeneration++;
                    this.broadcasts.set([]);
                    if (playlist && content.length) void this.loadStalkerSportsEpg('stalker:' + key);
                }
            }
        });
    }

    private async loadXtreamSportsEpg(cacheKey: string): Promise<void> {
        const store = this.xtream;
        if (!store) return;
        const generation = ++this.epgGeneration;
        const cached = sportsGuideCache.get(cacheKey);
        if (cached && Date.now() - cached.checked < SPORTS_GUIDE_TTL) {
            this.broadcasts.set(cached.items);
            return;
        }
        const sportsIds = new Set(this.sportsCategories().filter(category =>
            !!identifySport(category.title)
        ).map(category => category.id));
        const candidates = store.liveStreams().filter(stream =>
            sportsIds.has(String(stream.category_id)) ||
            !!identifySport(stream.name)
        ).slice(0,80);
        const results: SportsBroadcast[] = [];
        for (let index=0; index<candidates.length; index+=6) {
            const batch = await Promise.all(candidates.slice(index,index+6).map(async item => {
                const id = Number(item.xtream_id ?? item.stream_id);
                if (!Number.isFinite(id) || id < 0) return [];
                try {
                    const epg = await store.loadChannelEpg(id, 12);
                    return parseSportsBroadcasts({
                        id: String(id), name:item.name,logo:item.stream_icon,
                    }, epg.map(x => ({
                        title:x.title,description:x.description,
                        start:x.start,stop:x.stop || x.end,
                        start_timestamp:x.start_timestamp,stop_timestamp:x.stop_timestamp,
                    })));
                } catch { return []; }
            }));
            if (generation !== this.epgGeneration) return;
            for (const item of batch) results.push(...item);
            // Stream discovered fixtures progressively; do not retain the entire
            // provider guide in the view while scanning more channels.
            this.broadcasts.set(results.slice());
        }
        if (generation === this.epgGeneration) {
            rememberGuide(cacheKey, results);
            this.broadcasts.set(results);
        }
    }

    private async loadStalkerSportsEpg(cacheKey: string): Promise<void> {
        const store = this.stalker;
        if (!store) return;
        const generation = ++this.epgGeneration;
        const cached = sportsGuideCache.get(cacheKey);
        if (cached && Date.now() - cached.checked < SPORTS_GUIDE_TTL) {
            this.broadcasts.set(cached.items);
            return;
        }
        const channels = store.itvChannels().filter(item =>
            !!identifySport(item.o_name || item.name || '')
        ).slice(0,60);
        const results: SportsBroadcast[] = [];
        for (let i=0; i<channels.length; i+=6) {
            const batch=await Promise.all(channels.slice(i,i+6).map(async channel => {
                try {
                    const programs=await store.fetchChannelEpg(channel.id,10);
                    return parseSportsBroadcasts({
                        id:String(channel.id),name:channel.o_name || channel.name,
                        logo:channel.logo,
                    },programs.map(x=>({
                        title:x.title,description:x.description,start:x.start,
                        stop:x.stop || x.end,start_timestamp:x.start_timestamp,
                        stop_timestamp:x.stop_timestamp,
                    })));
                } catch { return []; }
            }));
            if (generation !== this.epgGeneration) return;
            for (const rows of batch) results.push(...rows);
            this.broadcasts.set(results.slice());
        }
        if (generation === this.epgGeneration) {
            rememberGuide(cacheKey, results);
            this.broadcasts.set(results);
        }
    }

    watchBroadcast(id: string): void {
        if (this.provider === 'stalker') {
            const channel = this.stalker?.itvChannels().find(c=>String(c.id)===id);
            if (channel) void this.stalker?.createLinkToPlayVod(
                channel.cmd,channel.o_name || channel.name,channel.logo
            );
            return;
        }
        const stream=this.xtream?.liveStreams().find(c =>
            String(c.xtream_id ?? c.stream_id) === id
        );
        if (!stream) return;
        const url=this.xtream?.constructStreamUrl(stream);
        if (url) this.xtream?.openPlayer(url,stream.name,stream.stream_icon);
    }

    openCompetition(categoryId: string): void {
        if (this.provider === 'stalker') {
            this.stalker?.setSelectedCategory(categoryId);
            this.stalker?.setPage(0);
            this.router.navigate(['../itv'], { relativeTo: this.route });
            return;
        }
        const id = Number(categoryId);
        if (!Number.isFinite(id)) return;
        this.xtream?.setSelectedContentType('live');
        this.xtream?.setSelectedCategory(id);
        this.router.navigate(['../live'], { relativeTo: this.route });
    }
}

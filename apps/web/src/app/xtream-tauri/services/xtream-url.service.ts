import { inject, Injectable } from '@angular/core';
import {
    XtreamSerieEpisode,
    XtreamVodDetails,
} from 'shared-interfaces';
import { SettingsStore } from '../../services/settings-store.service';
import { XtreamCredentials } from './xtream-api.service';

/**
 * Extended playlist with optional HTTP headers
 */
export interface XtreamPlaylistWithHeaders extends XtreamCredentials {
    id: string;
    name: string;
    type?: string;
    userAgent?: string;
    referrer?: string;
    origin?: string;
}

/**
 * Live stream item with xtream_id
 */
export interface LiveStreamItem {
    xtream_id: number;
    [key: string]: unknown;
}

/**
 * Service for constructing Xtream stream URLs.
 * Handles URL construction for live streams, VOD, and series episodes.
 */
@Injectable({ providedIn: 'root' })
export class XtreamUrlService {
    private readonly settingsStore = inject(SettingsStore);

    /**
     * Construct live stream URL
     * Format: {serverUrl}/live/{username}/{password}/{streamId}.{format}
     */
    constructLiveUrl(
        credentials: XtreamCredentials,
        xtreamId: number,
        format?: string
    ): string {
        const streamFormat =
            format ?? this.settingsStore.streamFormat() ?? 'ts';
        return `${credentials.serverUrl}/live/${credentials.username}/${credentials.password}/${xtreamId}.${streamFormat}`;
    }

    /**
     * Construct VOD stream URL
     * Format: {serverUrl}/movie/{username}/{password}/{streamId}.{extension}
     */
    constructVodUrl(
        credentials: XtreamCredentials,
        vodItem: XtreamVodDetails
    ): string {
        // Prefer the actual provider media URL when Xtream supplies one.
        // Generic /movie/ URLs are not equivalent for all IPTV servers.
        const directSource = vodItem.movie_data?.direct_source?.trim();
        if (directSource && /^https?:\/\//i.test(directSource)) {
            return directSource;
        }
        const streamId =
            vodItem.movie_data?.stream_id ?? (vodItem as any).stream_id;
        const requestedExtension = vodItem.movie_data?.container_extension?.trim();
        const extension = requestedExtension &&
            /^[a-z0-9]{2,6}$/i.test(requestedExtension)
            ? requestedExtension : 'mp4';
        const server = credentials.serverUrl.replace(/\/+$/, '');
        return `${server}/movie/${credentials.username}/${credentials.password}/${streamId}.${extension}`;
    }

    /**
     * Construct series episode stream URL
     * Format: {serverUrl}/series/{username}/{password}/{episodeId}.{extension}
     */
    constructEpisodeUrl(
        credentials: XtreamCredentials,
        episode: XtreamSerieEpisode
    ): string {
        const server = credentials.serverUrl.replace(/\/+$/, '');
        const extension = /^[a-z0-9]{2,6}$/i.test(
            episode.container_extension || ''
        ) ? episode.container_extension : 'mp4';
        return `${server}/series/${credentials.username}/${credentials.password}/${episode.id}.${extension}`;
    }
}

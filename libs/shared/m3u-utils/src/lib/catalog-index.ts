import { Channel } from 'shared-interfaces';

export type CatalogKind = 'live' | 'movies' | 'series';
export interface EpisodeIdentity {
    title: string;
    season: number;
    episode: number;
}
export function getEpisodeIdentity(name = ''): EpisodeIdentity | null {
    const match =
        /^(.*?)\s*[-–]?\s*(?:S(\d{1,3})\s*E(\d{1,4})|(\d{1,3})x(\d{1,4})|T(?:EMPORADA)?\s*(\d{1,3})\s*[- .]*\s*(?:EP?|EPIS[ÓO]DIO)\s*(\d{1,4}))(?:\b|$)/i.exec(
            name
        );
    return match
        ? {
              title: match[1].trim(),
              season: Number(match[2] || match[4] || match[6]),
              episode: Number(match[3] || match[5] || match[7]),
          }
        : null;
}

export function classifyCatalogChannel(channel: Channel): CatalogKind {
    const path = (channel.url || '').split(/[?#]/, 1)[0];
    if (/\/series\//i.test(path)) return 'series';
    if (/\/movies?\//i.test(path)) return 'movies';
    const group = (channel.group?.title || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ');
    if (getEpisodeIdentity(channel.name)) return 'series';
    if (
        /\b(series|seriados|novelas|temporadas|episodios|doramas|netflix|apple tv|discovery|prime video|disney|globoplay|hbo max|paramount|star|amc plus|lionsgate|outras produtoras|brasil paralelo|claro video|directv|sbt|crunchyroll|funimation|plutotv|programas de tv|legendadas|univer)\b/.test(
            group
        )
    )
        return 'series';
    if (/\b(filmes|filme|movies|movie|vod|cinema)\b/.test(group))
        return 'movies';
    // Provider movie categories are often just genres, with decorative symbols.
    // Explicit live labels still win over genres such as documentaries/sports.
    if (/\b(canais|tv|live|ao vivo|radio)\b/.test(group)) return 'live';
    if (/\besportes\b/.test(group) && /[✔✅]/u.test(channel.group?.title || '')) return 'movies';
    if (
        /\b(lancamentos|uhd|4k|acao|animacao|aventura|crime|comedia|familia|drama|ficcao|guerra|especial infantil|fantasia|faroeste|nacionais|religiosos|legendados|romance|suspense|terror|dublagem nao oficial|documentario|documentarios|shows|stand up|reelshorts|adultos)\b/.test(
            group
        )
    )
        return 'movies';
    if (/\b(canais|tv|live|ao vivo|esportes|noticias|radio)\b/.test(group))
        return 'live';
    if (/\.(mp4|mkv|avi|mov|m4v|webm|wmv|divx)$/i.test(path)) return 'movies';
    if (
        /\b(lancamentos|acao|aventura|comedia|terror|romance|suspense|ficcao)\b/.test(
            group
        ) &&
        /\b(?:19|20)\d{2}\b/.test(channel.name)
    )
        return 'movies';
    return 'live';
}

export interface CatalogIndex {
    live: Channel[];
    movies: Channel[];
    series: Channel[];
    kinds: Map<string, CatalogKind>;
    episodes: Map<string, EpisodeIdentity>;
    seriesItems: Map<string, Channel[]>;
}
export const emptyCatalogIndex = (): CatalogIndex => ({
    live: [],
    movies: [],
    series: [],
    kinds: new Map(),
    episodes: new Map(),
    seriesItems: new Map(),
});
export const seriesKey = (channel: Channel, title: string): string =>
    JSON.stringify([channel.group?.title || '', title]);

/** One pass, yielding between batches so large catalogs keep the UI responsive. */
export async function buildCatalogIndex(
    channels: Channel[],
    progress: (percent: number) => void = () => {},
    canceled: () => boolean = () => false
): Promise<CatalogIndex> {
    const index = emptyCatalogIndex();
    for (let offset = 0; offset < channels.length; offset += 1000) {
        if (canceled()) return index;
        const end = Math.min(offset + 1000, channels.length);
        for (let i = offset; i < end; i++) {
            const channel = channels[i];
            const kind = classifyCatalogChannel(channel);
            index.kinds.set(channel.id, kind);
            if (kind !== 'series') {
                index[kind].push(channel);
                continue;
            }
            const episode = getEpisodeIdentity(channel.name);
            if (!episode) {
                index.series.push(channel);
                continue;
            }
            index.episodes.set(channel.id, episode);
            const key = seriesKey(channel, episode.title);
            const episodes = index.seriesItems.get(key);
            if (episodes) episodes.push(channel);
            else {
                index.seriesItems.set(key, [channel]);
                index.series.push(channel);
            }
        }
        progress(Math.round((end / channels.length) * 100));
        if (end < channels.length)
            await new Promise((resolve) => setTimeout(resolve, 0));
    }
    progress(100);
    return index;
}

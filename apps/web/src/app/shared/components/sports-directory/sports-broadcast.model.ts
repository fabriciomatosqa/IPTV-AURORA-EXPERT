import { identifySport, SportName } from './sports-directory.model';

export interface SportsGuideChannel {
    id: string;
    name: string;
    logo?: string;
}
export interface SportsGuideProgram {
    title?: string;
    description?: string;
    desc?: string | null;
    category?: string | null;
    start?: string;
    stop?: string;
    end?: string;
    start_timestamp?: string;
    stop_timestamp?: string;
}
export interface SportsBroadcast {
    id: string;
    title: string;
    sport: SportName;
    competition: string;
    start: number;
    stop: number;
    replay: boolean;
    channel: SportsGuideChannel;
}
export function parseSportsBroadcasts(
    channel: SportsGuideChannel, programmes: readonly SportsGuideProgram[], now = Date.now()
): SportsBroadcast[] {
    const valid: SportsBroadcast[] = [];
    for (const program of programmes) {
        const start = Number(program.start_timestamp) > 1e9 ?
            Number(program.start_timestamp) * 1000 : Date.parse(program.start || '');
        const stop = Number(program.stop_timestamp) > 1e9 ?
            Number(program.stop_timestamp) * 1000 : Date.parse(program.stop || program.end || '');
        if (!Number.isFinite(start) || !Number.isFinite(stop) ||
            stop <= start || stop < now - 2 * 3600000 || start > now + 14 * 86400000)
            continue;
        const title = String(program.title || '').trim();
        // Never infer a match solely from a channel named ESPN or SporTV.
        const detected = identifySport(title) ||
            identifySport(String(program.category || '')) ||
            identifySport(String(program.description || program.desc || ''));
        if (!detected || detected.sport === 'Outros esportes') continue;
        valid.push({
            id: channel.id + ':' + start + ':' + title,
            title,
            sport: detected.sport,
            competition: detected.competition,
            start, stop,
            replay: /\b(reprise|replay|repeti[cç][aã]o)\b/i.test(title),
            channel,
        });
    }
    return valid;
}
export function sportsBroadcastStatus(b: SportsBroadcast, now: number): string {
    if (b.replay) return 'REPRISE';
    if (b.start <= now && b.stop > now) return 'AO VIVO';
    if (b.start > now) return 'EM BREVE';
    return 'ENCERRADO';
}

import type { SportsMatch } from './sports-feed.model';
import type { SportsBroadcast } from './sports-broadcast.model';

export interface SportsDayGroup {
    key: string;
    title: string;
    games: SportsMatch[];
}

/** Identical heading and card grid for every date, in the user's local timezone. */
export function groupSportsMatchesByDay(matches: readonly SportsMatch[]): SportsDayGroup[] {
    const days = new Map<string, SportsDayGroup>();
    for (const match of [...matches].sort((a, b) => a.kickoff - b.kickoff)) {
        const date = new Date(match.kickoff);
        const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')].join('-');
        let group = days.get(key);
        if (!group) {
            const title = new Intl.DateTimeFormat('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
            }).format(date).toLocaleUpperCase('pt-BR');
            group = { key, title, games: [] };
            days.set(key, group);
        }
        group.games.push(match);
    }
    return [...days.values()];
}

/** One button per actual channel, even if its EPG repeats the same fixture. */
export function distinctSportsChannels(items: readonly SportsBroadcast[]): SportsBroadcast[] {
    const byChannel = new Map<string, SportsBroadcast>();
    for (const item of items) {
        if (!byChannel.has(item.channel.id)) byChannel.set(item.channel.id, item);
    }
    return [...byChannel.values()];
}

export interface SportsBroadcastDay {
    key: string;
    title: string;
    broadcasts: SportsBroadcast[];
}

export function groupSportsBroadcastsByDay(broadcasts: readonly SportsBroadcast[]): SportsBroadcastDay[] {
    const byDay = new Map<string, SportsBroadcastDay>();
    for (const broadcast of [...broadcasts].sort((a, b) => a.start - b.start)) {
        const date = new Date(broadcast.start);
        const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')].join('-');
        let group = byDay.get(key);
        if (!group) {
            group = { key, title: new Intl.DateTimeFormat('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
            }).format(date).toLocaleUpperCase('pt-BR'), broadcasts: [] };
            byDay.set(key, group);
        }
        group.broadcasts.push(broadcast);
    }
    return [...byDay.values()];
}

/**
 * When the IPTV guide identifies no fixture, keep a small, clearly-labelled
 * public calendar rather than an empty sports page. This NEVER confirms an IPTV
 * channel: only linked fixtures may show an Assistir button.
 */
export function selectFootballCardFixtures(
    candidates: readonly SportsMatch[],
    confirmedIds: ReadonlySet<string>,
    liveOnly: boolean,
    publicLimit = 36,
): { games: SportsMatch[]; publicCalendar: boolean } {
    const verified = candidates.filter(match => confirmedIds.has(match.id));
    if (verified.length)
        return { games: verified, publicCalendar: false };
    // "Ao Vivo" can still show independently verified public scores, but
    // never represent any IPTV channel as confirmed without an EPG match.
    const eligible = liveOnly
        ? candidates.filter(match => match.state === 'live')
        : candidates;
    const upcoming = eligible.filter(match =>
        match.state === 'live' || match.kickoff >= Date.now() - 2 * 3600000);
    const history = eligible.filter(match =>
        match.state !== 'live' && match.kickoff < Date.now() - 2 * 3600000);
    // Prioritize today's live/upcoming fixtures over historic scores, but
    // sort cards back into the same chronological day sections afterwards.
    const upcomingCount = Math.min(publicLimit, upcoming.length);
    const historyCount = Math.min(history.length, publicLimit - upcomingCount);
    const limited = [
        ...(historyCount ? history.slice(-historyCount) : []),
        ...upcoming.slice(0, upcomingCount),
    ].sort((a,b) => a.kickoff - b.kickoff);
    return { games: limited, publicCalendar: limited.length > 0 };
}

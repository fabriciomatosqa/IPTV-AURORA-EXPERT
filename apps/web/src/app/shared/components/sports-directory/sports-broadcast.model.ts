import type { SportsMatch } from './sports-feed.model';
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
    details: string;
    sport: SportName;
    competition: string;
    start: number;
    stop: number;
    replay: boolean;
    channel: SportsGuideChannel;
}
/** A program must name both sides of a fixture before it can trigger
 * scoreboard discovery. Generic football shows do not prove a match exists. */
export function sportsGuideHasFixture(program: Pick<SportsBroadcast, 'title' | 'details'>): boolean {
    const text = program.title + ' ' + program.details;
    return /[\p{L}0-9]{2,}(?:[\p{L}0-9 .'-]{0,60})\s+(?:x|×|vs\.?)\s+[\p{L}0-9]{2,}/iu.test(text);
}

export function footballLeaguesFromGuide(broadcasts: readonly SportsBroadcast[]): string[] {
    const fixtures = broadcasts.filter(b => b.sport === 'Futebol' && sportsGuideHasFixture(b));
    if (!fixtures.length) return [];
    const leagues = new Set<string>();
    for (const b of fixtures) {
        const text = (b.competition + ' ' + b.title + ' ' + b.details).normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (/serie\s*b|brasileiro\s*b/.test(text)) leagues.add('bra.2');
        else if (/serie\s*a|brasileir[a-z]*o|campeonato brasileiro/.test(text)) leagues.add('bra.1');
        if (/libertadores/.test(text)) leagues.add('conmebol.libertadores');
        if (/sul.americana|sudamericana/.test(text)) leagues.add('conmebol.sudamericana');
        if (/copa do mundo|world cup|fifa/.test(text)) leagues.add('fifa.world');
        if (/premier league|ingles|english/.test(text)) leagues.add('eng.1');
        if (/la liga|laliga|espanhol|spanish/.test(text)) leagues.add('esp.1');
        if (/champions league|liga dos campeoes/.test(text)) leagues.add('uefa.champions');
    }
    // Team-only guide titles give no reliable competition. Search the compact,
    // date-scoped allowlist rather than downloading whole seasons.
    return leagues.size ? [...leagues] :
        ['bra.1', 'bra.2', 'conmebol.libertadores', 'conmebol.sudamericana',
            'fifa.world', 'eng.1', 'esp.1', 'uefa.champions'];
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
            stop <= start || stop < now - 3 * 86400000 || start > now + 14 * 86400000)
            continue;
        const title = String(program.title || '').trim().slice(0, 180);
        const details = String(program.description || program.desc || '').trim().slice(0, 750);
        // A named fixture is football evidence even when the EPG omits the league.
        // Merely naming ESPN or SporTV is never evidence.
        const fixture = sportsGuideHasFixture({ title, details });
        const detected = identifySport(title) ||
            identifySport(String(program.category || '')) ||
            identifySport(details);
        const verified = fixture && (!detected || detected.sport === 'Outros esportes')
            ? { sport: 'Futebol' as SportName, competition: 'Futebol' }
            : detected;
        if (!verified || verified.sport === 'Outros esportes') continue;
        valid.push({
            id: channel.id + ':' + start + ':' + title,
            title, details,
            sport: verified.sport,
            competition: verified.competition,
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

/** Attach a public score to an IPTV transmission ONLY with explicit team
 * evidence in the EPG and a plausible broadcast window. Provider channel
 * names (ESPN, SporTV etc.) alone are never evidence.
 */
export function confirmedMatchBroadcasts(
    match: SportsMatch, broadcasts: readonly SportsBroadcast[]
): SportsBroadcast[] {
    const normalize = (value: string): string =>
        String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const aliases: Record<string, string[]> = {
        'atletico mg': ['atletico mineiro', 'galo', 'cam'],
        'athletico pr': ['atletico paranaense', 'athletico paranaense', 'furacao', 'cap'],
        'atletico pr': ['atletico paranaense', 'athletico paranaense', 'furacao', 'cap'],
        'corinthians': ['sccp', 'timao'],
        'palmeiras': ['sep', 'verdao'],
        'sao paulo': ['spfc'],
        'flamengo': ['fla', 'mengo'],
        'fluminense': ['flu', 'fluminense rj'],
        'gremio': ['gremio fbpa'],
        'internacional': ['inter rs', 'sport club internacional'],
        'vasco da gama': ['vasco', 'crvg'],
        'red bull bragantino': ['bragantino', 'rb bragantino'],
        'botafogo': ['botafogo rj', 'bfr'],
        'cruzeiro': ['cruzeiro mg', 'cec'],
        'vitoria': ['vitoria ba', 'ecv'],
        'athletic club': ['athletic mg'],
    };
    const drop = new Set(['club','clube','sport','football','futebol','associacao',
        'esportiva','fc','sc','ac','de','do','da','dos','das','the']);
    const variants = (name: string) => {
        const key = normalize(name);
        return [key, ...(aliases[key] || [])];
    };
    const homeVariants = variants(match.home.name);
    const awayVariants = variants(match.away.name);
    const homeWords = normalize(match.home.name).split(' ')
        .filter(w => w.length >= 2 && !drop.has(w));
    const awayWords = normalize(match.away.name).split(' ')
        .filter(w => w.length >= 2 && !drop.has(w));
    const uniqueHome = homeWords.filter(w => !awayWords.includes(w));
    const uniqueAway = awayWords.filter(w => !homeWords.includes(w));
    const contains = (haystack: string, token: string) =>
        haystack.includes(' ' + token + ' ');
    const hasTeam = (haystack: string, choices: string[], unique: string[]) =>
        choices.some(choice => contains(haystack, choice)) ||
        unique.length > 0 && unique.some(word => contains(haystack, word));
    if ((!uniqueHome.length && homeVariants.length < 2) ||
        (!uniqueAway.length && awayVariants.length < 2)) return [];
    return broadcasts.filter(airing => {
        if (airing.sport !== match.sport) return false;
        const timeDiff = airing.start - match.kickoff;
        if (!airing.replay && Math.abs(timeDiff)>120*60000) return false;
        if (airing.replay && (timeDiff<0 || timeDiff>7*86400000)) return false;
        const description = ' ' + normalize(airing.title + ' ' + airing.details) + ' ';
        // Both distinct opponents must appear, not just a named broadcaster.
        return hasTeam(description, homeVariants, uniqueHome) &&
            hasTeam(description, awayVariants, uniqueAway);
    });
}

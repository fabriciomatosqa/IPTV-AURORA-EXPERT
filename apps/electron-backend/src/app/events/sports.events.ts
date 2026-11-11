import { ipcMain } from 'electron';

/**
 * Same public sources as the Android sports hub. Only allowlisted resource
 * names reach the network. No IPTV URLs, credentials or channel names are sent.
 */
export type SportsRequest =
    | { kind: 'scoreboard'; league: string; startDate?: string; endDate?: string }
    | { kind: 'timeline'; league: string; eventId: string }
    | { kind: 'teamBadge'; team: string }
    | { kind: 'f1'; resource: 'races' | 'drivers' | 'teams'; year: number };

const LEAGUES: Record<string, { sport: string; slug: string; season?: boolean }> = {
    'bra.1': { sport: 'soccer', slug: 'bra.1', season: true },
    'bra.2': { sport: 'soccer', slug: 'bra.2', season: true },
    'conmebol.libertadores': { sport: 'soccer', slug: 'conmebol.libertadores' },
    'conmebol.sudamericana': { sport: 'soccer', slug: 'conmebol.sudamericana' },
    'fifa.world': { sport: 'soccer', slug: 'fifa.world' },
    'eng.1': { sport: 'soccer', slug: 'eng.1' },
    'esp.1': { sport: 'soccer', slug: 'esp.1' },
    'uefa.champions': { sport: 'soccer', slug: 'uefa.champions' },
    'uefa.wchampions': { sport: 'soccer', slug: 'uefa.wchampions' },
    'uefa.europa': { sport: 'soccer', slug: 'uefa.europa' },
    'ger.1': { sport: 'soccer', slug: 'ger.1' },
    'ita.1': { sport: 'soccer', slug: 'ita.1' },
    'fra.1': { sport: 'soccer', slug: 'fra.1' },
    'nba': { sport: 'basketball', slug: 'nba' },
    'wnba': { sport: 'basketball', slug: 'wnba' },
    'nfl': { sport: 'football', slug: 'nfl' },
    'mlb': { sport: 'baseball', slug: 'mlb' },
    'nhl': { sport: 'hockey', slug: 'nhl' },
    'atp': { sport: 'tennis', slug: 'atp' },
    'wta': { sport: 'tennis', slug: 'wta' },
};

type SportsResponse = { data: unknown | null; checked: number; stale: boolean };
const cache = new Map<string, SportsResponse>();
const inflight = new Map<string, Promise<SportsResponse>>();
let nextBadgeRequest = Promise.resolve();
let badgeCooldown = 0;

function safeBadge(raw: unknown, team: string): { logo: string } {
    const list = (raw as { teams?: unknown })?.teams;
    if (!Array.isArray(list)) return { logo: '' };
    const normalize = (s: string) => String(s || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const target = normalize(team);
    const found = list.find((item: unknown) => {
        const entry = item as { strTeam?: string; strSport?: string };
        return normalize(entry.strTeam || '') === target &&
            (!entry.strSport || /soccer|football/i.test(entry.strSport));
    }) as { strBadge?: string } | undefined;
    const url = String(found?.strBadge || '');
    return { logo: /^https:\/\/(?:www\.|r2\.)?thesportsdb\.com\/images\//.test(url) ? url : '' };
}

function validDates(start?: string, end?: string): boolean {
    if (!start || !end || !/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) return false;
    const parse = (value: string) => Date.parse(value.slice(0, 4) + '-' +
        value.slice(4, 6) + '-' + value.slice(6, 8) + 'T00:00:00Z');
    const from = parse(start), to = parse(end);
    return Number.isFinite(from) && Number.isFinite(to) &&
        new Date(from).toISOString().slice(0, 10).replace(/-/g, '') === start &&
        new Date(to).toISOString().slice(0, 10).replace(/-/g, '') === end &&
        to >= from && to - from <= 20 * 86400000;
}

function endpoint(request: SportsRequest): { url: string; ttl: number } | null {
    if (request?.kind === 'scoreboard') {
        const league = typeof request.league === 'string' ? LEAGUES[request.league] : null;
        if (!league) return null;
        const from = request.startDate, to = request.endDate;
        if ((from || to) && !validDates(from, to)) return null;
        const scoped = !!(from && to);
        const year = new Date().getUTCFullYear();
        const dates = scoped ? `&dates=${from}-${to}` : league.season ? `&dates=${year}` : '';
        const limit = scoped ? 100 : league.season ? 500 : 100;
        return {
            url: `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.slug}/scoreboard?limit=${limit}${dates}`,
            ttl: scoped ? 2 * 60 * 1000 : league.season ? 6 * 60 * 60 * 1000 : 2 * 60 * 1000,
        };
    }
    if (request?.kind === 'teamBadge') {
        const name = typeof request.team === 'string' ? request.team.trim() : '';
        if (!name || name.length > 55 ||
            !/^[\p{L}\p{N} .'-]+$/u.test(name)) return null;
        return {
            url: 'https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=' + encodeURIComponent(name),
            ttl: 24 * 60 * 60 * 1000,
        };
    }
    if (request?.kind === 'timeline') {
        const league = typeof request.league === 'string' ? LEAGUES[request.league] : null;
        if (!league || !/^\d{1,15}$/.test(String(request.eventId || ''))) return null;
        return {
            url: `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.slug}/summary?event=${request.eventId}`,
            ttl: 90 * 1000,
        };
    }
    if (request?.kind === 'f1') {
        const year = Number(request.year);
        if (!Number.isInteger(year) || year < 1950 || year > new Date().getUTCFullYear() + 1)
            return null;
        const path = {
            races: `${year}/`,
            drivers: `${year}/driverStandings/`,
            teams: `${year}/constructorStandings/`,
        }[request.resource];
        if (!path) return null;
        return { url: `https://api.jolpi.ca/ergast/f1/${path}?limit=100`, ttl: 6 * 60 * 60 * 1000 };
    }
    return null;
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Aurora-IPTV-Expert/0.0 Sports' },
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
    });
    if (!response.ok) throw new Error(`Sports feed responded ${response.status}`);
    const payload = await response.text();
    if (payload.length > 4_000_000) throw new Error('Sports response exceeds size limit');
    return JSON.parse(payload);
}

export function registerSportsEvents(): void {
    ipcMain.handle('AURORA_SPORTS_FEED', async (_event, request: SportsRequest): Promise<SportsResponse> => {
        const config = endpoint(request);
        if (!config) return { data: null, checked: 0, stale: true };
        const now = Date.now();
        const stored = cache.get(config.url);
        if (stored && now - stored.checked < config.ttl) return stored;
        const ongoing = inflight.get(config.url);
        if (ongoing) return ongoing;

        const task = (async (): Promise<SportsResponse> => {
            try {
                // TheSportsDB shared free tier has a 30/minute limit.
                // Serialize badge requests at <= 24/min, without slowing scores.
                let data: unknown;
                if (request.kind === 'teamBadge') {
                    const run = nextBadgeRequest.then(async () => {
                        const delay = Math.max(0, badgeCooldown - Date.now());
                        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
                        badgeCooldown = Date.now() + 2500;
                        return safeBadge(await fetchJson(config.url), request.team);
                    });
                    nextBadgeRequest = run.then(() => undefined, () => undefined);
                    data = await run;
                } else data = await fetchJson(config.url);
                const result = { data, checked: Date.now(), stale: false };
                cache.set(config.url, result);
                // Bound the in-memory cache; a long session must not retain
                // every date range or match summary ever requested.
                if (cache.size > 160) cache.delete(cache.keys().next().value!);
                return result;
            } catch {
                // Preserve the last known verified response and identify it as stale.
                return { data: stored?.data ?? null, checked: stored?.checked ?? 0, stale: true };
            } finally {
                inflight.delete(config.url);
            }
        })();
        inflight.set(config.url, task);
        return task;
    });
}

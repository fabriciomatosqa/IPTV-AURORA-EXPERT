/** Normalizes public sports feeds. A scoreboard is separate from IPTV playback: an
 * official fixture must NEVER be represented as a confirmed channel broadcast.
 */
export interface SportsTeam { name: string; logo: string; score: string | null }
export type SportsMatchState = 'scheduled' | 'live' | 'finished' | 'postponed';
export interface SportsMatch {
    id: string;
    league: string;
    competition: string;
    sport: string;
    kickoff: number;
    home: SportsTeam;
    away: SportsTeam;
    state: SportsMatchState;
    clock: string;
    logo: string;
}
export interface F1Race {
    round: number;
    title: string;
    circuit: string;
    country: string;
    date: number;
    hasTime: boolean;
    sessions: { title: string; time: number; hasTime: boolean }[];
}
export interface F1Standing {
    position: number;
    name: string;
    team: string;
    points: number;
    wins: number;
}
export interface F1Season {
    year: number;
    races: F1Race[];
    drivers: F1Standing[];
    teams: F1Standing[];
}
const safeImage = (value: unknown): string => {
    const url = String(value ?? '');
    return /^https:\/\/a\.espncdn\.com\//.test(url) ? url : '';
};
const stamp = (value: unknown): number => {
    const time = Date.parse(String(value ?? ''));
    return Number.isFinite(time) ? time : 0;
};
const object = (value: unknown): Record<string, any> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const flatten = <T, R>(rows: T[], mapper: (row: T) => R[]): R[] =>
    rows.reduce((all: R[], row) => all.concat(mapper(row)), []);
const score = (value: unknown): string | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim();
    return null;
};

export function parseSportsScoreboard(raw: unknown, league: string, sport: string): SportsMatch[] {
    const feed = object(raw);
    const leagueInfo = object(array(feed.leagues)[0]);
    const competition = String(leagueInfo.name || league);
    const leagueLogo = safeImage(object(array(leagueInfo.logos)[0]).href);
    return flatten(array(feed.events),(item): SportsMatch[] => {
        const event = object(item);
        const contest = object(array(event.competitions)[0]);
        const competitors = array(contest.competitors);
        const home = object(competitors.find(t => object(t).homeAway === 'home'));
        const away = object(competitors.find(t => object(t).homeAway === 'away'));
        if (!event.id || !home.team || !away.team) return [];
        const status = object(event.status);
        const type = object(status.type);
        const state: SportsMatchState = /postponed|canceled|cancelled/i.test(String(type.name || type.description || ''))
            ? 'postponed' : type.state === 'post' || type.completed === true
                ? 'finished' : type.state === 'in' ? 'live' : 'scheduled';
        const getTeam = (entry: Record<string, any>): SportsTeam => {
            const team = object(entry.team);
            return {
                name: String(team.displayName || team.shortDisplayName || team.name || '?'),
                logo: safeImage(team.logo || object(array(team.logos)[0]).href),
                score: score(entry.score),
            };
        };
        const kickoff = stamp(event.date || contest.date);
        if (!kickoff) return [];
        return [{
            id: league + ':' + String(event.id),
            league,
            competition,
            sport,
            kickoff,
            home: getTeam(home),
            away: getTeam(away),
            state,
            clock: String(status.displayClock || type.shortDetail || type.description || ''),
            logo: leagueLogo,
        }];
    }).sort((a, b) => a.kickoff - b.kickoff);
}


export interface SportsTimelineEvent {
    id: string;
    minute: string;
    title: string;
    description: string;
    team: string;
    icon: string;
    order: number;
}

/** Extract only actual provider events, never synthesize goals or cards from scores.
 * ESPN summaries vary by league and sometimes omit a play-by-play entirely. */
export function parseSportsTimeline(raw: unknown): SportsTimelineEvent[] {
    const data = object(raw);
    const competition = object(array(object(data.header).competitions)[0]);
    const candidates = [
        ...array(data.keyEvents),
        ...array(data.plays),
        ...array(data.scoringPlays),
        ...array(data.details),
        ...array(competition.details),
    ];
    const seen = new Set<string>();
    const result: SportsTimelineEvent[] = [];
    for (const item of candidates) {
        const event = object(item);
        const kind = object(event.type);
        const clock = object(event.clock);
        const description = String(event.text || event.description ||
            event.shortText || kind.text || kind.description || '').trim();
        if (!description) continue;
        const category = String(kind.text || kind.description || kind.name || '') + ' ' + description;
        const normalized = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let title = '', icon = 'info';
        if (/own goal|gol contra/.test(normalized)) { title = 'Gol contra'; icon = 'sports_soccer'; }
        else if (/penalty|penalti/.test(normalized) && /goal|gol|scor/.test(normalized)) {
            title = 'Gol de pênalti'; icon = 'sports_soccer';
        }
        else if (/goal|gol|scor/.test(normalized)) { title = 'Gol'; icon = 'sports_soccer'; }
        else if (/yellow|amarelo/.test(normalized)) { title = 'Cartão amarelo'; icon = 'style'; }
        else if (/red card|vermelho|second yellow/.test(normalized)) { title = 'Cartão vermelho'; icon = 'style'; }
        else if (/substitution|substituicao|substitui/.test(normalized)) {
            title = 'Substituição'; icon = 'sync_alt';
        }
        else if (/var|video assistant/.test(normalized)) { title = 'VAR'; icon = 'videocam'; }
        else if (/half.time|full.time|kick.off|period|intervalo|fim de jogo/.test(normalized)) {
            title = 'Etapa da partida'; icon = 'schedule';
        }
        else continue; // Do not show miscellaneous commentary as verified match events.
        const minute = String(clock.displayValue || event.displayClock ||
            event.minute || event.time || '').trim();
        const number = Number.parseInt(minute.replace(/[^0-9].*$/, ''), 10);
        const order = Number.isFinite(number) ? number : result.length + 1000;
        const team = object(event.team);
        const teamName = String(team.displayName || team.name || '').trim();
        const key = String(event.id || '') || [minute, normalized, teamName].join(':');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ id:key, minute, title, description:description.slice(0,300),
            team:teamName, icon, order });
    }
    return result.sort((a,b) => a.order - b.order).slice(0,150);
}

export function parseF1Calendar(raw: unknown, year: number): F1Race[] {
    const data = object(object(raw).MRData);
    return flatten(array(object(data.RaceTable).Races),(row): F1Race[] => {
        const race = object(row);
        const round = Number(race.round);
        const confirmedTime = /^\d{2}:\d{2}(?::\d{2})?Z$/.test(String(race.time || ''));
        const time = stamp(String(race.date ?? '') + 'T' +
            (confirmedTime ? String(race.time) : '00:00:00Z'));
        if (!Number.isInteger(round) || round < 1 || !time) return [];
        const circuit = object(race.Circuit);
        const sessions = flatten([
            ['FirstPractice', 'Treino Livre 1'],
            ['SecondPractice', 'Treino Livre 2'],
            ['ThirdPractice', 'Treino Livre 3'],
            ['Qualifying', 'Classificação'],
            ['Sprint', 'Sprint'],
            ['SprintQualifying', 'Classificação Sprint'],
        ], ([key, title]): { title: string; time: number; hasTime: boolean }[] => {
            const session = object(race[key]);
            const hasTime = /^\d{2}:\d{2}(?::\d{2})?Z$/.test(String(session.time || ''));
            const t = stamp(String(session.date || '') + 'T' +
                (hasTime ? String(session.time) : '00:00:00Z'));
            return t ? [{ title, time: t, hasTime }] : [];
        });
        sessions.push({ title: 'Corrida', time, hasTime: confirmedTime });
        sessions.sort((a,b) => a.time - b.time);
        return [{
            round, title: String(race.raceName || 'Grande Prêmio ' + round),
            country: String(object(circuit.Location).country || ''),
            circuit: String(circuit.circuitName || ''),
            date: time, hasTime: confirmedTime, sessions,
        }];
    }).sort((a,b) => a.date - b.date);
}

export function parseF1Standings(raw: unknown, kind: 'drivers' | 'teams'): F1Standing[] {
    const table = object(object(raw).MRData).StandingsTable;
    const list = object(array(object(table).StandingsLists)[0]);
    const rows = array(list[kind === 'drivers' ? 'DriverStandings' : 'ConstructorStandings']);
    return flatten(rows,(r): F1Standing[] => {
        const row = object(r);
        const driver = object(row.Driver);
        const team = object(row.Constructor);
        const name = kind === 'drivers'
            ? [driver.givenName, driver.familyName].filter(Boolean).join(' ')
            : String(team.name || '');
        const position = Number(row.position);
        if (!name || !Number.isInteger(position) || position < 1) return [];
        return [{
            position, name,
            team: kind === 'drivers'
                ? array(row.Constructors).map(c => object(c).name).filter(Boolean).join(' / ')
                : '',
            points: Number(row.points) || 0,
            wins: Number(row.wins) || 0,
        }];
    }).sort((a,b) => a.position - b.position);
}

/** Event states are determined from the official feed, never guessed from the current time. */
export function sportsMatchLabel(match: SportsMatch): string {
    return match.state === 'live' ? 'AO VIVO' :
        match.state === 'finished' ? 'ENCERRADO' :
        match.state === 'postponed' ? 'ADIADO' : 'AGENDADO';
}

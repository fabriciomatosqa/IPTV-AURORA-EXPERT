import { SportsBroadcast } from './sports-broadcast.model';
import { SportsMatch } from './sports-feed.model';
import { SportName } from './sports-directory.model';

export interface SportsCompetition {
    section: string;
    sectionTitle: string;
    rank: number;
    competition: string;
}
export interface SportsGuideCard {
    id: string;
    title: string;
    home: string;
    away: string;
    start: number;
    stop: number;
    replay: boolean;
    competition: SportsCompetition;
    grandPrix: string;
    session: string;
    channels: SportsBroadcast[];
}
export interface SportsCatalogCard {
    id: string;
    start: number;
    match?: SportsMatch;
    guide?: SportsGuideCard;
}
export interface SportsCatalogDay {
    key: string;
    title: string;
    cards: SportsCatalogCard[];
}
export interface SportsCatalogCompetition {
    key: string;
    title: string;
    days: SportsCatalogDay[];
}
export interface SportsCatalogSection {
    key: string;
    title: string;
    rank: number;
    competitions: SportsCatalogCompetition[];
}

export function sportText(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const has = (text: string, regex: RegExp): boolean => regex.test(text);
export function classifySportsCompetition(sport: SportName, title: string,
    details = '', hint = '', league = ''): SportsCompetition {
    const text = sportText(title + ' ' + details + ' ' + hint + ' ' + league);
    if (sport === 'Futebol') {
        if (league === 'bra.2' || has(text, /\b(?:brasileir[a-z]*o|campeonato brasileiro|serie b)\b/) && has(text, /\bserie b\b/))
            return { section: 'bra-b', sectionTitle: 'Campeonato Brasileiro Série B', rank: 1, competition: 'Série B' };
        if (league === 'bra.1' || has(text, /\b(?:brasileir[a-z]*o|campeonato brasileiro|serie a)\b/) && has(text, /\bserie a\b/))
            return { section: 'bra-a', sectionTitle: 'Campeonato Brasileiro Série A', rank: 0, competition: 'Série A' };
        if (league === 'conmebol.libertadores' || has(text, /libertadores/))
            return { section: 'libertadores', sectionTitle: 'Copa Libertadores', rank: 2, competition: 'Libertadores' };
        if (league === 'fifa.world' || has(text, /\bfifa\b|copa do mundo|world cup|mundial de clubes/))
            return { section: 'fifa', sectionTitle: 'Campeonatos FIFA', rank: 3,
                competition: has(text, /mundial de clubes|club world/) ? 'Mundial de Clubes' : 'Competições FIFA' };
        const europe = {
            champions: has(text, /champions|liga dos campeoes/),
            europa: has(text, /europa league|liga europa/),
            premier: has(text, /premier league|campeonato ingles/),
            laliga: has(text, /la liga|laliga|campeonato espanhol/),
            bundesliga: has(text, /bundesliga|campeonato alemao/),
            seriea: has(text, /serie a italiana|campeonato italiano/),
            ligue1: has(text, /ligue 1|campeonato frances/),
        };
        const isEurope = Object.values(europe).some(Boolean) ||
            ['uefa.champions','eng.1','esp.1'].includes(league);
        if (isEurope) {
            const women = has(text, /feminin|women|womens|women s/);
            const competition = europe.champions || league === 'uefa.champions'
                ? women ? 'Liga dos Campeões Feminina' : 'Liga dos Campeões'
                : europe.europa ? 'Liga Europa'
                : europe.premier || league === 'eng.1' ? 'Premier League'
                : europe.laliga || league === 'esp.1' ? 'La Liga'
                : europe.bundesliga ? 'Bundesliga'
                : europe.seriea ? 'Campeonato Italiano' : 'Campeonato Francês';
            return { section: 'europe', sectionTitle: 'Campeonatos europeus', rank: 4, competition };
        }
        if (league === 'conmebol.sudamericana' || has(text, /sul americana|sudamericana/))
            return { section: 'other', sectionTitle: 'Outros campeonatos da lista', rank: 5,
                competition: 'Copa Sul-Americana' };
        if (has(text, /copa do brasil/))
            return { section: 'other', sectionTitle: 'Outros campeonatos da lista', rank: 5,
                competition: 'Copa do Brasil' };
        return { section: 'other', sectionTitle: 'Outros campeonatos da lista', rank: 5,
            competition: hint && sportText(hint) !== 'futebol' ? hint : 'Outros jogos' };
    }
    if (sport === 'Automobilismo') {
        const series = has(text, /\bmotogp\b|\bmoto gp\b/) ? ['motogp','MotoGP',1] as const
            : has(text, /\bstock\s*car\b|\bstockcar\b/) ? ['stockcar','Stock Car',2] as const
            : has(text, /\bindy\b|\bindycar\b/) ? ['indy','INDY',3] as const
            : has(text, /\bnascar\b/) ? ['nascar','NASCAR',4] as const
            : has(text, /\bf1\b|\bformula 1\b/) ? ['f1','Fórmula 1',0] as const
            : ['motor-other','Outros campeonatos do automobilismo',5] as const;
        return {section:series[0],sectionTitle:series[1],rank:series[2],competition:series[1]};
    }
    const known = league === 'nba' ? 'NBA' : league === 'wnba' ? 'WNBA'
        : league === 'nfl' ? 'NFL' : league === 'mlb' ? 'MLB'
        : league === 'nhl' ? 'NHL' : '';
    const explicit = known || (hint && sportText(hint) !== sportText(sport) ? hint : sport);
    const value = sportText(explicit);
    return { section:value || 'other', sectionTitle:explicit, rank:0, competition:explicit };
}

export function extractGuideTeams(title: string, details = ''): { home: string; away: string } | null {
    // An EPG may append commentary/description after " | ". Prefer its concise fixture.
    const lines = (title + ' | ' + details).split(/\s*[|]\s*/);
    for (const line of lines) {
        const prefix = line.split(/\s+[-–—]\s+/)[0].replace(/^(?:ao vivo|futebol|jogo|partida)\s*:\s*/i,'').trim();
        const match = /^(.{2,90}?)\s+(?:x|×|vs\.?)\s+(.{2,90})$/iu.exec(prefix);
        if (!match) continue;
        const home = match[1].trim(), away = match[2].trim();
        if (sportText(home).length < 2 || sportText(away).length < 2) continue;
        return { home, away };
    }
    return null;
}

export function identifyMotorSession(title: string): string {
    const text = sportText(title);
    if (/treino livre 1|\bfp1\b/.test(text)) return 'Treino Livre 1';
    if (/treino livre 2|\bfp2\b/.test(text)) return 'Treino Livre 2';
    if (/treino livre 3|\bfp3\b/.test(text)) return 'Treino Livre 3';
    if (/classificacao sprint|sprint qualifying/.test(text)) return 'Classificação Sprint';
    if (/\bclassificacao\b|\bqualifying\b/.test(text)) return 'Classificação';
    if (/\bsprint\b/.test(text)) return 'Sprint';
    if (/\bcorrida\b|\brace\b|\bprova\b/.test(text)) return 'Corrida';
    if (/\btreino\b|\bpractice\b/.test(text)) return 'Treino';
    return 'Sessão / programação';
}

export function identifyGrandPrix(title: string): string {
    const matched = /(?:grande\s+pr[eê]mio|grand\s+prix|\bgp\b)\s*(?:do|da|de|dos|das)?\s*([^\-|,|:]{2,50})/i.exec(title);
    if (!matched) return 'Grande Prêmio / evento';
    return ('Grande Prêmio ' + matched[1].replace(/\b(treino|classifica[cç][aã]o|corrida|sprint).*$/i,'').trim())
        .replace(/\s+/g, ' ').trim();
}
function dayKey(time: number): string {
    const date = new Date(time);
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'),
        String(date.getDate()).padStart(2,'0')].join('-');
}
function dayTitle(time: number): string {
    return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'})
        .format(new Date(time)).toLocaleUpperCase('pt-BR');
}
export function groupSportsGuideEvents(broadcasts: readonly SportsBroadcast[],
    sport: SportName): SportsGuideCard[] {
    const groups = new Map<string, SportsGuideCard[]>();
    for (const broadcast of [...broadcasts].sort((a,b)=>a.start-b.start)) {
        if (broadcast.sport !== sport) continue;
        const teams = sport === 'Futebol'
            ? extractGuideTeams(broadcast.title, broadcast.details) : null;
        if (sport === 'Futebol' && !teams) continue;
        const comp = classifySportsCompetition(sport,broadcast.title,broadcast.details,
            broadcast.competition);
        const grandPrix = sport === 'Automobilismo'
            ? identifyGrandPrix(broadcast.title + ' ' + broadcast.details) : '';
        // Series (F1 / MotoGP / INDY) > Grand Prix > day > session > channels.
        if (sport === 'Automobilismo')
            comp.competition = grandPrix === 'Grande Prêmio / evento'
                ? 'Outros eventos da série' : grandPrix;
        const session = sport === 'Automobilismo'
            ? identifyMotorSession(broadcast.title) : '';
        const participants = teams
            ? [sportText(teams.home),sportText(teams.away)].sort().join(':')
            : sport === 'Automobilismo'
                ? sportText(grandPrix + ' ' + session)
                : sportText(broadcast.title);
        const key = [comp.section,comp.competition,dayKey(broadcast.start),
            participants,broadcast.replay ? 'replay' : 'live'].join('|');
        let bucket = groups.get(key);
        if (!bucket) { bucket=[]; groups.set(key,bucket); }
        // Guide air times may vary slightly by channel. Never merge events
        // hours apart or on different days merely because teams are equal.
        let existing = bucket.find(card => Math.abs(card.start-broadcast.start) <= 90*60000);
        if (!existing) {
            existing = {
                id: 'guide:' + key + ':' + broadcast.start,
                title: teams ? teams.home+' × '+teams.away : broadcast.title,
                home:teams?.home || '',away:teams?.away || '',
                start:broadcast.start,stop:broadcast.stop,replay:broadcast.replay,
                competition:comp,grandPrix,session,channels:[],
            };
            bucket.push(existing);
        }
        if (!existing.channels.some(item=>item.channel.id===broadcast.channel.id))
            existing.channels.push(broadcast);
        existing.stop=Math.max(existing.stop,broadcast.stop);
    }
    return [...groups.values()].reduce((all:SportsGuideCard[],rows)=>
        all.concat(rows),[]).sort((a,b)=>a.start-b.start);
}

export function buildSportsCatalog(matches: readonly SportsMatch[],
    guideGroups: readonly SportsGuideCard[], sport: SportName): SportsCatalogSection[] {
    const sections=new Map<string,SportsCatalogSection>();
    const put = (competition:SportsCompetition, card:SportsCatalogCard) => {
        let section=sections.get(competition.section);
        if(!section) {
            section={key:competition.section,title:competition.sectionTitle,
                rank:competition.rank,competitions:[]};
            sections.set(competition.section,section);
        }
        let item=section.competitions.find(c=>c.title===competition.competition);
        if(!item) {
            item={key:competition.section+'|'+competition.competition,
                title:competition.competition,days:[]};
            section.competitions.push(item);
        }
        const key=dayKey(card.start);
        let day=item.days.find(d=>d.key===key);
        if(!day){
            day={key,title:dayTitle(card.start),cards:[]};
            item.days.push(day);
        }
        day.cards.push(card);
    };
    for (const match of matches) {
        const competition=classifySportsCompetition(sport,match.competition,'','',match.league);
        put(competition,{id:match.id,start:match.kickoff,match});
    }
    for (const guide of guideGroups) {
        put(guide.competition,{id:guide.id,start:guide.start,guide});
    }
    const result=[...sections.values()].sort((a,b)=>a.rank-b.rank ||
        a.title.localeCompare(b.title,'pt-BR'));
    for(const section of result) {
        section.competitions.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
        for(const competition of section.competitions){
            competition.days.sort((a,b)=>a.key.localeCompare(b.key));
            for(const day of competition.days)day.cards.sort((a,b)=>a.start-b.start);
        }
    }
    return result;
}

/**
 * A playlist-aware sports index. Sports and competitions are only shown if
 * the actual playlist supplies a matching category or channel title.
 * Original source IDs remain attached to entries for navigation.
 */
export type SportName = 'Futebol' | 'Automobilismo' | 'Basquete' | 'Vôlei' |
    'Tênis' | 'Lutas' | 'Outros esportes';

export interface SportsSource {
    id: string;
    title: string;
    count?: number;
}

export interface SportsEntry extends SportsSource {
    sport: SportName;
    competition: string;
}

export interface SportsSection {
    title: SportName;
    entries: SportsEntry[];
}

const order: SportName[] = [
    'Futebol', 'Automobilismo', 'Basquete', 'Vôlei', 'Tênis', 'Lutas', 'Outros esportes'
];

const normalized = (value: string): string =>
    String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();

export function identifySport(title: string): { sport: SportName; competition: string } | null {
    const name = normalized(title);
    if (!name) return null;

    // Priority is important: NBB, F1, NBA or MotoGP must not fall into generic sports.
    if (/\b(nba|wnba|nbb|euroleague|euroliga|basquete|basketball|fiba)\b/.test(name)) {
        const competition = /\bwnba\b/.test(name) ? 'WNBA' :
            /\bnbb\b/.test(name) ? 'NBB' :
            /\b(euroleague|euroliga)\b/.test(name) ? 'Euroliga' :
            /\bnba\b/.test(name) ? 'NBA' : title.trim();
        return { sport: 'Basquete', competition };
    }
    if (/\b(formula\s*(1|2|3|e)|f1|f2|f3|nascar|motogp|moto\s*gp|moto2|moto3|indy(car)?|stock\s*car|automobilismo|endurance|wrc|rally|le\s*mans)\b/.test(name)) {
        const competition = /\b(f1|formula\s*1)\b/.test(name) ? 'Fórmula 1' :
            /\bnascar\b/.test(name) ? 'NASCAR' :
            /\b(motogp|moto\s*gp)\b/.test(name) ? 'MotoGP' :
            /\b(indy|indycar)\b/.test(name) ? 'IndyCar' : title.trim();
        return { sport: 'Automobilismo', competition };
    }
    if (/\b(voleibol|volei|volleyball|superliga\s*(feminina|masculina)?|liga\s*das\s*nacoes\s*de\s*volei)\b/.test(name)) {
        return { sport: 'Vôlei', competition: /superliga/.test(name) ? 'Superliga Brasileira de Vôlei' : title.trim() };
    }
    if (/\b(tenis|tennis|atp|wta|wimbledon|roland.garros|us\s*open|australian\s*open)\b/.test(name)) {
        return { sport: 'Tênis', competition: title.trim() };
    }
    if (/\b(ufc|mma|boxe|boxing|judo|jiu.jitsu|lutas|combate)\b/.test(name)) {
        return { sport: 'Lutas', competition: title.trim() };
    }
    if (/\b(brasileir[aã]o|brasileirao|serie\s*[a-d]|s[eé]rie\s*[a-d]|libertadores|sul.americana|copa\s*do\s*brasil|futebol|football|soccer|champions\s*league|premier\s*league|la\s*liga|bundesliga|uefa|copa\s*do\s*mundo|fifa|paulista|carioca|mineiro|gauch[aã]o|gauchao)\b/.test(name)) {
        const competition = /brasileirao|brasileir[aã]o|campeonato\s*brasileiro/.test(name) &&
            /\b(serie|s[eé]rie)\s*a\b/.test(name) ? 'Campeonato Brasileiro Série A' :
            /brasileirao|brasileir[aã]o|campeonato\s*brasileiro/.test(name) &&
            /\b(serie|s[eé]rie)\s*b\b/.test(name) ? 'Campeonato Brasileiro Série B' :
            /libertadores/.test(name) ? 'Copa Libertadores' :
            /sul.americana/.test(name) ? 'Copa Sul-Americana' :
            /copa\s*do\s*brasil/.test(name) ? 'Copa do Brasil' : title.trim();
        return { sport: 'Futebol', competition };
    }
    if (/\b(esportes?|sports?|espn|sportv|dazn|premiere|ppv\s*esportes?)\b/.test(name)) {
        return { sport: 'Outros esportes', competition: title.trim() };
    }
    return null;
}

export function organizeSports(categories: readonly SportsSource[]): SportsSection[] {
    const sections = new Map<SportName, SportsEntry[]>();
    for (const category of categories) {
        const match = identifySport(category.title);
        if (!match) continue;
        const entries = sections.get(match.sport) || [];
        entries.push({ ...category, ...match });
        sections.set(match.sport, entries);
    }
    return order.filter(name => sections.has(name)).map(title => ({
        title,
        entries: (sections.get(title) || []).sort((a,b) =>
            a.competition.localeCompare(b.competition, 'pt-BR')
        ),
    }));
}

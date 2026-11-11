import {
    parseSportsScoreboard, parseF1Calendar, parseF1Standings, sportsMatchLabel,
} from './sports-feed.model';

describe('Android sports feed desktop adapter', () => {
    const event = {
        id: '123',
        date: '2026-11-09T20:00Z',
        status: { type: { state: 'in', description: 'Em andamento' }, displayClock: '34\'' },
        competitions: [{ competitors: [
            { homeAway: 'home', score: '2', team: { displayName: 'Time A', logo: 'https://a.espncdn.com/logo-a.png' } },
            { homeAway: 'away', score: '1', team: { displayName: 'Time B', logo: 'https://other-host.invalid/logo.png' } },
        ] }],
    };
    it('decodes a genuine live score without fabricating streaming links', () => {
        const [match] = parseSportsScoreboard({
            leagues: [{name:'Brasileirão',logos:[{href:'https://a.espncdn.com/league.png'}]}],
            events: [event],
        }, 'bra.1', 'Futebol');
        expect(match.home.name).toBe('Time A');
        expect(match.home.score).toBe('2');
        expect(match.away.logo).toBe('');
        expect(match.state).toBe('live');
        expect(sportsMatchLabel(match)).toBe('AO VIVO');
        expect(Object.keys(match)).not.toContain('channelUrl');
    });
    it('handles unavailable/invalid fixtures safely', () => {
        expect(parseSportsScoreboard({events:[{id:'a'}]},'nba','Basquete')).toEqual([]);
    });
    it('normalizes F1 calendar and standings with racing sessions', () => {
        const races = parseF1Calendar({MRData:{RaceTable:{Races:[{
            round:'3',raceName:'Grande Prêmio Exemplo',date:'2026-11-09',time:'16:00:00Z',
            Circuit:{circuitName:'Circuito',Location:{country:'Brasil'}},
            Qualifying:{date:'2026-11-08',time:'16:00:00Z'},
        }]}}}, 2026);
        expect(races[0].round).toBe(3);
        expect(races[0].sessions.map(x=>x.title)).toEqual(['Classificação','Corrida']);
        const standings = parseF1Standings({MRData:{StandingsTable:{StandingsLists:[{
            DriverStandings:[{ position:'1',points:'120.5',wins:'3',
                Driver:{givenName:'Maria',familyName:'Silva'},Constructors:[{name:'Equipe'}]}],
        }]}}}, 'drivers');
        expect(standings[0].team).toBe('Equipe');
        expect(standings[0].points).toBe(120.5);
    });

    it('parses only real provider timeline events and removes duplicates', () => {
        const { parseSportsTimeline } = require('./sports-feed.model');
        const goals = {id:'goal-12',clock:{displayValue:"12'"},
            type:{text:'Goal'},text:'Goal scored by player',team:{name:'Casa'}};
        const entries = parseSportsTimeline({
            keyEvents:[goals,{id:'yellow-25',clock:{displayValue:"25'"},
                type:{text:'Yellow Card'},text:'Yellow Card player'}],
            plays:[goals,{id:'other',text:'Commentary, no verified match event'}],
        });
        expect(entries).toHaveLength(2);
        expect(entries.map((e: {title:string})=>e.title)).toEqual(['Gol','Cartão amarelo']);
        expect(entries[0].team).toBe('Casa');
        expect(parseSportsTimeline({})).toEqual([]);
    });

});

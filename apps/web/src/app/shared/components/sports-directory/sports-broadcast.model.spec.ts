import { parseSportsBroadcasts, sportsBroadcastStatus, confirmedMatchBroadcasts } from './sports-broadcast.model';
describe('Sports guide links never guess broadcasters', () => {
    const now = Date.parse('2026-11-08T19:00:00Z');
    it('links only explicit sports EPG programmes to their real channel', () => {
        const programmes = parseSportsBroadcasts({id:'stream-20',name:'ESPN'}, [
            {title:'Brasileirão Série A Corinthians x Palmeiras',
             start:'2026-11-08T18:00:00Z',stop:'2026-11-08T20:00:00Z'},
            {title:'Programa sem esporte',start:'2026-11-08T18:00:00Z',
             stop:'2026-11-08T20:00:00Z'},
            {title:'NBA - Reprise',start:'2026-11-08T18:00:00Z',
             stop:'2026-11-08T20:00:00Z'},
        ],now);
        expect(programmes).toHaveLength(2);
        expect(programmes[0].channel.id).toBe('stream-20');
        expect(sportsBroadcastStatus(programmes[0],now)).toBe('AO VIVO');
        expect(sportsBroadcastStatus(programmes[1],now)).toBe('REPRISE');
    });
    it('matches a verified scoreboard game to a genuine EPG broadcast, not generic sports channels', () => {
        const fixtures = parseSportsBroadcasts({id:'ESPN-01',name:'ESPN'},[
            {title:'Brasileirão Série A Corinthians x Palmeiras',
                start:'2026-11-08T18:00:00Z',stop:'2026-11-08T20:00:00Z'},
            {title:'Programa da ESPN',start:'2026-11-08T18:00:00Z',stop:'2026-11-08T20:00:00Z'},
        ],now);
        const match = {sport:'Futebol',kickoff:now-30*60000,
            home:{name:'Corinthians'},away:{name:'Palmeiras'}} as any;
        const linked = confirmedMatchBroadcasts(match,fixtures);
        expect(linked).toHaveLength(1);
        expect(linked[0].channel.id).toBe('ESPN-01');
        expect(confirmedMatchBroadcasts({...match,away:{name:'Flamengo'}},fixtures)).toEqual([]);
    });
    it('rejects expired and invalid programme dates', () => {
        expect(parseSportsBroadcasts({id:'a',name:'A'},[
            {title:'NBA',start:'invalid',stop:'invalid'},
            {title:'NBA',start:'2025-01-01T10:00:00Z',stop:'2025-01-01T12:00:00Z'},
        ],now)).toEqual([]);
    });

    it('detects a team-only programme and never assigns a sports broadcaster by channel name alone', () => {
        const rows = parseSportsBroadcasts({ id:'1',name:'ESPN HD' },[
            {title:'Corinthians x Palmeiras',start:'2026-11-08T19:00:00Z',
                stop:'2026-11-08T21:00:00Z'},
            {title:'Debate esportivo',start:'2026-11-08T19:00:00Z',
                stop:'2026-11-08T21:00:00Z'},
        ],now);
        expect(rows).toHaveLength(1);
        expect(rows[0].sport).toBe('Futebol');
        expect(rows[0].channel.id).toBe('1');
    });
    it('keeps league B separate from league A in programme-driven discovery', () => {
        const { footballLeaguesFromGuide } = require('./sports-broadcast.model');
        const rows = parseSportsBroadcasts({id:'1',name:'Premiere'},[
            {title:'Brasileirão Série B Remo x Vila Nova',
                start:'2026-11-08T19:00:00Z',stop:'2026-11-08T21:00:00Z'},
        ],now);
        expect(footballLeaguesFromGuide(rows)).toEqual(['bra.2']);
    });

});

import { distinctSportsChannels, groupSportsMatchesByDay } from './sports-day.model';
import type { SportsMatch } from './sports-feed.model';
import type { SportsBroadcast } from './sports-broadcast.model';

describe('Aurora sports dated layout', () => {
    const match = (id: string, day: number, hour: number): SportsMatch => ({
        id, league: 'bra.1', competition: 'Brasileirão',
        sport: 'Futebol', kickoff: new Date(2026, 10, day, hour).getTime(),
        home:{name:'Casa',logo:'',score:null},
        away:{name:'Fora',logo:'',score:null},
        logo:'',state:'scheduled',clock:'',
    });
    it('gives EVERY date the same explicit full heading, with ordered cards', () => {
        const groups = groupSportsMatchesByDay([
            match('b',11,21),match('a',10,19),match('c',11,18),
        ]);
        expect(groups).toHaveLength(2);
        expect(groups[0].title).toBe('TERÇA-FEIRA, 10 DE NOVEMBRO');
        expect(groups[1].title).toBe('QUARTA-FEIRA, 11 DE NOVEMBRO');
        expect(groups[1].games.map(m => m.id)).toEqual(['c','b']);
    });
    it('shows the same IPTV channel only once when the EPG lists repeated programs', () => {
        const rows = [
            {id:'one',channel:{id:'12',name:'Canal HD'}},
            {id:'two',channel:{id:'12',name:'Canal HD'}},
            {id:'three',channel:{id:'13',name:'Canal 2'}},
        ] as SportsBroadcast[];
        expect(distinctSportsChannels(rows).map(x => x.channel.id)).toEqual(['12','13']);
    });
});

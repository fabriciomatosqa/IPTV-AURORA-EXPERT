import { SportsBroadcast } from './sports-broadcast.model';
import type { SportsMatch } from './sports-feed.model';
import {
    buildSportsCatalog, classifySportsCompetition, extractGuideTeams,
    groupSportsGuideEvents, identifyMotorSession, identifyGrandPrix,
} from './sports-catalog.model';

describe('AURORA sport championship and IPTV channel hierarchy', () => {
    const now = Date.parse('2026-11-10T23:30:00Z');
    const broadcast = (id: string, title: string, minutes = 0,
        sport: SportsBroadcast['sport']='Futebol'): SportsBroadcast => ({
        id: id+':'+minutes,
        title,
        details: title,
        sport,
        competition:sport,
        start:now+minutes*60000,
        stop:now+(minutes+130)*60000,
        replay:false,
        channel:{id,name:'Canal '+id,logo:''},
    });

    it('classifies Brazilian A/B, Libertadores, FIFA, Europe and other championships', () => {
        const examples = [
            ['Campeonato Brasileiro Série A', 'bra-a'],
            ['Campeonato Brasileiro Série B', 'bra-b'],
            ['Copa Libertadores', 'libertadores'],
            ['Copa do Mundo FIFA', 'fifa'],
            ['Liga dos Campeões de Futebol Feminino', 'europe'],
            ['Copa do Brasil', 'other'],
        ] as const;
        for (const [name,group] of examples)
            expect(classifySportsCompetition('Futebol',name).section).toBe(group);
        expect(classifySportsCompetition('Futebol','PSG x Bayern de Munique - Liga dos Campeões de Futebol Feminino')
            .competition).toBe('Liga dos Campeões Feminina');
    });

    it('unites five channels for the SAME PSG vs Bayern game in a single card', () => {
        const label='PSG x Bayern de Munique - Liga dos Campeões de Futebol Feminino';
        const rows=[0,1,2,3,4].map((id) => broadcast('channel-'+id,label,id*2));
        const groups=groupSportsGuideEvents(rows,'Futebol');
        expect(groups).toHaveLength(1);
        expect(groups[0].channels).toHaveLength(5);
        expect(groups[0].home).toBe('PSG');
        expect(groups[0].away).toBe('Bayern de Munique');
        const catalog=buildSportsCatalog([],groups,'Futebol');
        expect(catalog).toHaveLength(1);
        expect(catalog[0].title).toBe('Campeonatos europeus');
        expect(catalog[0].competitions[0].days[0].cards).toHaveLength(1);
    });

    it('deduplicates the same channel but keeps other channels and games on different dates', () => {
        const label='Flamengo x Palmeiras - Brasileirão Série A';
        const a=broadcast('same',label);
        const groups=groupSportsGuideEvents([
            a,{...a,id:'duplicate guide record'},
            broadcast('second',label,5),
            broadcast('tomorrow',label,1440),
        ],'Futebol');
        expect(groups).toHaveLength(2);
        expect(groups[0].channels.map(c=>c.channel.id)).toEqual(['same','second']);
        expect(groups[1].channels).toHaveLength(1);
    });

    it('keeps F1/MotoGP/Stock Car/INDY series and Grand Prix sessions separated', () => {
        const rows=[
            broadcast('a','F1 GP São Paulo - Treino Livre 1',0,'Automobilismo'),
            broadcast('b','F1 GP São Paulo - Classificação',90,'Automobilismo'),
            broadcast('c','F1 GP São Paulo - Corrida',180,'Automobilismo'),
            broadcast('d','MotoGP GP Catalunha - Corrida',180,'Automobilismo'),
            broadcast('e','Stock Car - Etapa Goiânia',0,'Automobilismo'),
            broadcast('f','INDY GP Indianapolis - Corrida',0,'Automobilismo'),
        ];
        const grouped=groupSportsGuideEvents(rows,'Automobilismo');
        expect(grouped).toHaveLength(6);
        expect(grouped.filter(x=>x.competition.section==='f1')).toHaveLength(3);
        expect(grouped.find(x=>x.competition.section==='motogp')?.session).toBe('Corrida');
        expect(grouped.find(x=>x.competition.section==='stockcar')).toBeTruthy();
        expect(grouped.find(x=>x.competition.section==='indy')).toBeTruthy();
        expect(identifyMotorSession(rows[0].title)).toBe('Treino Livre 1');
        expect(identifyGrandPrix(rows[0].title)).toContain('São Paulo');
    });

    it('groups scoreboards in the requested competition/date chronology', () => {
        const match=(id:string,league:string,offset:number):SportsMatch=>({
            id,sport:'Futebol',league,competition:'Liga',
            kickoff:now+offset*60000,
            home:{name:'Team A',logo:'',score:null},
            away:{name:'Team B',logo:'',score:null},
            state:'scheduled',clock:'',logo:'',
        });
        const c=buildSportsCatalog([
            match('b','bra.2',10),match('a','bra.1',20),match('e','eng.1',5),
        ],[],'Futebol');
        expect(c.map(x=>x.key)).toEqual(['bra-a','bra-b','europe']);
        expect(c[0].competitions[0].days[0].cards[0].id).toBe('a');
    });
    it('does not manufacture a team fixture from generic sports commentary', () => {
        expect(extractGuideTeams('Melhores momentos da Premier League')).toBeNull();
        expect(groupSportsGuideEvents([
            broadcast('tv','Debate de Futebol sem jogo'),
        ],'Futebol')).toEqual([]);
    });
});

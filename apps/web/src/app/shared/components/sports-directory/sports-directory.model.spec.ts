import { identifySport, organizeSports } from './sports-directory.model';

describe('playlist sports index', () => {
    it('groups championships under the correct sport using actual playlist entries', () => {
        const result = organizeSports([
            { id: '9', title: 'Brasileirão Série A' },
            { id: '12', title: 'Brasileirão Série B' },
            { id: '21', title: 'F1' },
            { id: '23', title: 'NASCAR' },
            { id: '30', title: 'NBA' },
            { id: '40', title: 'Superliga de Vôlei' },
            { id: '55', title: 'Cinema' },
        ]);
        expect(result.map(s => s.title)).toEqual(['Futebol','Automobilismo','Basquete','Vôlei']);
        expect(result[0].entries.map(x => x.competition)).toEqual([
            'Campeonato Brasileiro Série A','Campeonato Brasileiro Série B'
        ]);
        expect(result[1].entries.map(x => x.competition)).toEqual(['Fórmula 1','NASCAR']);
        expect(result[1].entries.map(x => x.id)).toEqual(['21','23']);
        expect(result.every(s => s.entries.every(e => e.title !== 'Cinema'))).toBe(true);
    });
    it('does not invent competitions absent from the playlist', () => {
        expect(organizeSports([{id:'1',title:'ESPN'}]).map(x => x.title)).toEqual(['Outros esportes']);
        expect(identifySport('Filmes Infantis')).toBeNull();
    });
});

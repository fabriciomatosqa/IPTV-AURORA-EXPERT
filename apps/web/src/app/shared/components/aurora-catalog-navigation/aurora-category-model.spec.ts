import { buildAuroraLiveGroups, categoryGroupParts } from './aurora-category-model';

describe('canonical Aurora live category hierarchy', () => {
    it('separates the provider category and subcategory without altering IDs', () => {
        const groups = buildAuroraLiveGroups([
            { id: '4', title: 'GLOBO | CAPITAIS', count: 89 },
            { id: '5', title: 'GLOBO | REGIONAIS', count: 287 },
            { id: '7', title: 'ESPN', count: 30 },
        ]);
        expect(groups.map(group => group.title)).toEqual(['GLOBO', 'ESPN']);
        expect(groups[0].children.map(child => [child.id, child.subtitle]))
            .toEqual([['4', 'CAPITAIS'], ['5', 'REGIONAIS']]);
        expect(groups[0].count).toBe(376);
        expect(groups[1].children[0].subtitle).toBe('Todos');
    });
    it('keeps duplicate names with different provider IDs selectable', () => {
        const groups = buildAuroraLiveGroups([
            { id: 'one', title: 'Canais | Esportes' },
            { id: 'two', title: 'Canais | Esportes' },
        ]);
        expect(groups[0].children.map(c => c.id)).toEqual(['one', 'two']);
    });
    it('puts adult categories at the end without hiding them', () => {
        const groups = buildAuroraLiveGroups([
            { id: 'a', title: 'Adultos | Onlyfans' },
            { id: 'b', title: 'Filmes | Infantis' },
            { id: 'c', title: 'Filmes | Adultos +18' },
        ]);
        expect(groups.map(x => x.title)).toEqual(['Filmes', 'Adultos']);
        expect(groups[0].children.map(x => x.subtitle)).toEqual(['Infantis','Adultos +18']);
    });
    it('does not invent a hierarchy based on arbitrary punctuation', () => {
        expect(categoryGroupParts('AÇÃO - AVENTURA')).toEqual({
            parent: 'AÇÃO - AVENTURA', child: 'Todos'
        });
        expect(categoryGroupParts('SPORTS / FHD')).toEqual({
            parent: 'SPORTS / FHD', child: 'Todos'
        });
    });
});

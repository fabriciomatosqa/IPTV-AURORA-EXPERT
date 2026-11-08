import { buildAuroraLiveGroups } from './aurora-category-model';

describe('canonical IPTV live navigation', () => {
    it('puts real M3U group titles under a single Canais root', () => {
        const groups = buildAuroraLiveGroups([
            { id: 'Variedades', title: 'Variedades', count: 121 },
            { id: 'ESPN', title: 'ESPN', count: 30 },
            { id: 'Globo Regionais', title: 'Globo Regionais', count: 287 },
        ]);
        expect(groups.map(group => group.title)).toEqual(['Canais']);
        expect(groups[0].count).toBe(438);
        expect(groups[0].children.map(child => [child.id, child.subtitle])).toEqual([
            ['Variedades', 'Variedades'],
            ['ESPN', 'ESPN'],
            ['Globo Regionais', 'Globo Regionais'],
        ]);
    });

    it('never splits a category title, including provider separators', () => {
        const groups = buildAuroraLiveGroups([
            { id: '4', title: 'GLOBO | CAPITAIS' },
            { id: '5', title: 'GLOBO | REGIONAIS' },
        ]);
        expect(groups[0].children.map(child => [child.id, child.subtitle])).toEqual([
            ['4', 'GLOBO | CAPITAIS'],
            ['5', 'GLOBO | REGIONAIS'],
        ]);
    });

    it('moves adult groups last while preserving all original IDs', () => {
        const groups = buildAuroraLiveGroups([
            { id: 'adult1', title: 'ADULTOS +18' },
            { id: 'safe', title: 'Infantis' },
        ]);
        expect(groups[0].children.map(child => child.id)).toEqual(['safe', 'adult1']);
    });

    it('returns no artificial category when a playlist contains no channels', () => {
        expect(buildAuroraLiveGroups([])).toEqual([]);
    });
});

import { adultsLast, columnWidthForLabels, isAdultCategory } from './aurora-category-order';

describe('Aurora: consistent category ordering and automatic sizing', () => {
    it('keeps normal categories in their original order and moves adult variants last', () => {
        const names = ['Adultos ❌ [ONLYFANS]', 'Drama', 'XXX | Filmes', 'Cinema', 'Pornô', 'Aventura', '+18'];
        expect(adultsLast(names, (name) => name)).toEqual([
            'Drama', 'Cinema', 'Aventura', 'Adultos ❌ [ONLYFANS]',
            'XXX | Filmes', 'Pornô', '+18',
        ]);
    });
    it('does not hide adult categories or treat neutral terms as pornography', () => {
        expect(isAdultCategory('Adultos ❌ [GAYS]')).toBe(true);
        expect(isAdultCategory('Pornografia')).toBe(true);
        expect(isAdultCategory('Documentários')).toBe(false);
        expect(isAdultCategory('Educação sexual')).toBe(false);
    });
    it('sizes using the longest label, regardless of category selection', () => {
        expect(columnWidthForLabels(['Filmes', 'GLOBO | REGIONAIS SUDESTE (125)']))
            .toBeGreaterThan(columnWidthForLabels(['Filmes']));
        expect(columnWidthForLabels(['X'.repeat(500)])).toBeLessThanOrEqual(620);
    });
});

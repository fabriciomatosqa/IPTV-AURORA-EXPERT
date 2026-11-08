import { catalogCategoryWidth } from './catalog-column-width';

describe('standardized IPTV category widths', () => {
    it('reserves enough space for the longest label including the count', () => {
        expect(catalogCategoryWidth(['ESPN (30)', 'GLOBO | REGIONAIS SUDESTE (125)']))
            .toBeGreaterThan(catalogCategoryWidth(['ESPN (30)']));
    });
    it('clamps pathological titles without taking over the content panel', () => {
        expect(catalogCategoryWidth(['X'.repeat(500)])).toBe(580);
        expect(catalogCategoryWidth([])).toBe(200);
    });
});

import { adultCategoryIds, isAdultContentLabel, moveAdultContentToEnd } from './adult-content-order';

describe('adult content is displayed last without removing it', () => {
    it.each(['Adultos ❌ [ONLYFANS]', 'Adultos ❤️ [+18]', 'XXX', 'Pornô', 'Pornografia',
        '18+', '+18', 'Hentai', 'Eróticos', 'Only Fans', '🔞'])(
        'recognizes the adult category %s', (title) => {
            expect(isAdultContentLabel(title)).toBe(true);
        }
    );

    it.each(['Documentários', 'Animação', 'Aventura', 'Drama', 'SEXTA-FEIRA', 'Adult Swim',
        'Educação sexual', 'Futebol sub-18', 'HBO'])(
        'does not misclassify %s', (title) => {
            expect(isAdultContentLabel(title)).toBe(false);
        }
    );

    it('retains every item and original relative order of both groups', () => {
        const items = ['XXX 1', 'Drama', 'Hentai', 'Ação', 'OnlyFans', 'Comédia'];
        const copy = [...items];
        expect(moveAdultContentToEnd(items, isAdultContentLabel)).toEqual([
            'Drama', 'Ação', 'Comédia', 'XXX 1', 'Hentai', 'OnlyFans',
        ]);
        expect(items).toEqual(copy);
    });

    it('identifies both provider category ids and cached local ids', () => {
        expect([...adultCategoryIds([
            { id: 123, category_id: '456', category_name: 'ADULTOS | +18' },
            { id: 789, category_name: 'Filmes' },
        ])]).toEqual(['456', '123']);
    });

    it('keeps titles with neutral names in adult categories at the end', () => {
        const adultIds = adultCategoryIds([
            { id: 2, name: 'OnlyFans' }, { id: 1, name: 'Filmes' },
        ]);
        const items = [
            { id: 'adult', category_id: 2, title: 'Cena 1' },
            { id: 'normal', category_id: 1, title: 'Cinema 1' },
        ];
        expect(moveAdultContentToEnd(items, item =>
            adultIds.has(String(item.category_id)) || isAdultContentLabel(item.title)
        ).map(item => item.id)).toEqual(['normal', 'adult']);
    });
});

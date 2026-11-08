import { Channel } from 'shared-interfaces';
import {
    buildCatalogIndex,
    classifyCatalogChannel,
    getEpisodeIdentity,
} from './catalog-index';

const item = (
    name: string,
    group: string,
    url = 'https://example.test/opaque/1'
) => ({ id: name, name, group: { title: group }, url }) as Channel;

describe('provider catalog classification', () => {
    it('recognizes the category names supplied in the provider screenshots', () => {
        const series = ['Novelas', 'Novelas Turcas', 'Netflix', 'Apple TV+', 'Discovery+', 'Prime Video', 'Disney+', 'Globoplay', 'HBO Max', 'Paramount+', 'Star+', 'AMC Plus', 'Lionsgate', 'Outras Produtoras', 'Brasil Paralelo', 'Claro video', 'DirecTV', 'SBT+', 'Crunchyroll', 'Funimation Now', 'PlutoTV', 'Programas de TV', 'Legendadas', 'Univer', 'Doramas', 'Doramas Legendados'];
        const movies = ['Cinema ⭐', 'Top Lançamentos 2026 ⭐', 'Ação ✔', 'UHD|4K ⭐', 'Animacao ✔', 'Aventura ✔', 'Crime ✔', 'Comedia ✔', 'Familia ✔', 'Drama ✔', 'Ficcao Cientifica ✔', 'Guerra', 'Especial Infantil', 'Fantasia', 'Faroeste', 'Nacionais', 'Religiosos', 'Legendados', 'Romance', 'Suspense', 'Terror', 'Dublagem Nao Oficial', 'Documentário', 'Esportes ✔', 'Shows', 'Stand Up Comedy', 'ReelShorts', 'Adultos', 'Filmes | Drama', 'Documentarios'];
        for (const group of series) expect([group, classifyCatalogChannel(item('Título', '♦ ' + group))]).toEqual([group, 'series']);
        for (const group of movies) expect([group, classifyCatalogChannel(item('Título', '♦ ' + group))]).toEqual([group, 'movies']);
    });
    it.each([
        ['Filme (2025)', '🎬 | FILMES • LANÇAMENTOS', '/opaque', 'movies'],
        ['Filme (2025)', 'Ação', '/opaque', 'movies'],
        ['Filme', 'Catálogo', '/opaque.mkv', 'movies'],
        ['Canal', 'TV | Cultura', '/opaque.mp4', 'live'],
        ['Canal', 'Notícias', '/opaque.ts', 'live'],
        ['Novela', '★ Novelas • Turcas', '/opaque', 'series'],
        ['Jornada', '♦ Netflix', '/opaque', 'series'],
        ['Jornada', '♦ Doramas Legendados', '/opaque.mp4', 'series'],
        ['Filme', '♦ Ação ✔', '/opaque', 'movies'],
        ['Filme', '♦ UHD|4K ⭐', '/opaque', 'movies'],
        ['Filme', '♦ Drama ✔', '/opaque.ts', 'movies'],
        ['Jornada 1x02', 'Dramas', '/opaque', 'series'],
        ['Jornada Temporada 2 Episódio 3', 'Dramas', '/opaque', 'series'],
        ['Jornada', '', '/series/u/p/1.mp4', 'series'],
        ['Filme', '', '/movie/u/p/1.ts', 'movies'],
    ])('%s / %s is %s', (name, group, path, kind) => {
        expect(
            classifyCatalogChannel(
                item(name, group, 'https://example.test' + path)
            )
        ).toBe(kind);
    });

    it('understands alternate episode markers', () => {
        for (const name of [
            'Jornada S02E03',
            'Jornada 2x03',
            'Jornada Temporada 2 Episódio 3',
            'Jornada T2 EP3',
        ])
            expect(getEpisodeIdentity(name)).toEqual({
                title: 'Jornada',
                season: 2,
                episode: 3,
            });
    });

    it('indexes a large catalog in batches and groups episodes without losing seasons', async () => {
        const channels = Array.from({ length: 10000 }, (_, i) =>
            item(`Canal ${i}`, 'TV')
        );
        channels.push(
            item('Jornada S01E01', 'Séries'),
            item('Jornada S02E01', 'Séries'),
            item('Filme', 'Filmes')
        );
        const progress: number[] = [];
        let yielded = false;
        setTimeout(() => {
            yielded = true;
        }, 0);
        const index = await buildCatalogIndex(channels, (p) =>
            progress.push(p)
        );
        expect(yielded).toBe(true);
        expect(index.live).toHaveLength(10000);
        expect(index.movies).toHaveLength(1);
        expect(index.series).toHaveLength(1);
        expect([...index.seriesItems.values()][0]).toHaveLength(2);
        expect(index.episodes.get('Jornada S02E01')?.season).toBe(2);
        expect(progress[progress.length - 1]).toBe(100);
    });

    it('stops work when navigating away', async () => {
        const index = await buildCatalogIndex(
            [item('Canal', 'TV')],
            () => {},
            () => true
        );
        expect(index.kinds.size).toBe(0);
    });
});

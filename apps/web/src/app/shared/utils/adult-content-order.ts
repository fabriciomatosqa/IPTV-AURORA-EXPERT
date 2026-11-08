/**
 * Presentation-only ordering for IPTV playlists. Nothing is deleted, hidden,
 * reclassified or written to a provider/database. This is shared by M3U,
 * Xtream and Stalker so categories have the same order across playlists.
 */
export function isAdultContentLabel(value: string | null | undefined): boolean {
    const label = String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
    return /(?:^|[^a-z0-9])(?:adult(?:os?|as?)?|porn[a-z]*|xxx|onlyfans|only\s+fans|hentai|erotic[a-z]*|xvideos|xhamster|redtube|brazzers|18\+|\+18|🔞)(?=$|[^a-z0-9])/.test(label);
}

/** Stable two-part ordering: leave the original order inside each group. */
export function moveAdultContentToEnd<T>(
    items: readonly T[],
    isAdult: (item: T) => boolean
): T[] {
    const ordinary: T[] = [];
    const adult: T[] = [];
    for (const item of items) {
        (isAdult(item) ? adult : ordinary).push(item);
    }
    return ordinary.concat(adult);
}

/** Category identifiers as strings work with local DB and provider IDs alike. */
export function adultCategoryIds(
    categories: readonly { id?: string | number; category_id?: string | number; category_name?: string; name?: string }[]
): Set<string> {
    const ids = new Set<string>();
    for (const category of categories) {
        if (isAdultContentLabel(category.category_name ?? category.name)) {
            const id = category.category_id ?? category.id;
            if (id !== null && id !== undefined) ids.add(String(id));
            // DB IDs and API IDs may coexist; keep both for cross-reference.
            if (category.id !== null && category.id !== undefined) ids.add(String(category.id));
        }
    }
    return ids;
}

/** Presentation-only category ordering: no provider IDs or saved content change. */
export function isAdultCategory(value: string): boolean {
    const name = (value || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return /(?:^|[^a-z0-9])(?:adult(?:o|a)?s?|porn[a-z]*|xxx|onlyfans|hentai|erotic[a-z]*|\+18|18\+)(?=$|[^a-z0-9])/.test(name);
}

/** Stable partition: keep source order within normal and adult categories. */
export function adultsLast<T>(items: readonly T[], label: (item: T) => string): T[] {
    const regular: T[] = [];
    const adult: T[] = [];
    for (const item of items) {
        (isAdultCategory(label(item)) ? adult : regular).push(item);
    }
    return regular.concat(adult);
}

/** Natural width for the longest full label and count, limited by the parent CSS. */
export function columnWidthForLabels(
    labels: readonly string[], padding = 92, max = 620,
): number {
    let context: CanvasRenderingContext2D | null = null;
    try {
        if (typeof document !== 'undefined') {
            context = document.createElement('canvas').getContext('2d');
            if (context) context.font = '14px "Segoe UI", sans-serif';
        }
    } catch { /* Canvas unavailable in test or server environments. */ }
    let widest = 190;
    for (const label of labels) {
        const textWidth = context ? context.measureText(label).width : label.length * 8;
        widest = Math.max(widest, Math.ceil(textWidth + padding));
        if (widest >= max) return max;
    }
    return widest;
}

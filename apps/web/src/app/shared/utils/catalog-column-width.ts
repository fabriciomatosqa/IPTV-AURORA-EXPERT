/** Measures complete category names and counts. The responsive CSS imposes the viewport bound. */
export function catalogCategoryWidth(labels: readonly string[], reserved = 82): number {
    let measure: CanvasRenderingContext2D | null = null;
    try {
        if (typeof document !== 'undefined') {
            measure = document.createElement('canvas').getContext('2d');
            if (measure) measure.font = '14px Segoe UI, sans-serif';
        }
    } catch { /* JSDOM / headless renderers may not provide canvas. */ }
    const max = 580;
    let width = 200;
    for (const label of labels) {
        const pixels = measure ? measure.measureText(label).width : label.length * 8;
        width = Math.max(width, Math.ceil(pixels + reserved));
        if (width >= max) return max;
    }
    return width;
}

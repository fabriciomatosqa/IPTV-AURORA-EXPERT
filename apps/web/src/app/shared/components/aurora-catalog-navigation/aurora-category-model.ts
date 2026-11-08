import { isAdultContentLabel, moveAdultContentToEnd } from '../../utils/adult-content-order';

export interface AuroraCategoryOption {
    /** The exact provider category ID (or exact M3U group title). */
    id: string;
    title: string;
    count?: number;
}

export interface AuroraLiveGroup {
    key: string;
    title: string;
    count?: number;
    children: Array<AuroraCategoryOption & { subtitle: string }>;
}

/**
 * M3U uses one root ("Canais") followed by its real EXTGRP/tvg group names.
 *
 * Xtream and Stalker categories must NOT pass through this function: their
 * original categories are flat, even if the name contains a pipe. Treating
 * "GLOBO | CAPITAIS" as two levels breaks the user's provider structure.
 * Both presentations preserve the same original category IDs.
 */
export function buildAuroraLiveGroups(items: readonly AuroraCategoryOption[]): AuroraLiveGroup[] {
    if (!items.length) return [];
    const children = moveAdultContentToEnd(items, item => isAdultContentLabel(item.title))
        .map(item => ({ ...item, subtitle: item.title }));
    const withCounts = items.every(item => item.count != null);
    return [{
        key: 'all-channels',
        title: 'Canais',
        count: withCounts ? items.reduce((sum, item) => sum + (item.count ?? 0), 0) : undefined,
        children,
    }];
}

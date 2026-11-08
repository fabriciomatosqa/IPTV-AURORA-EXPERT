import { isAdultContentLabel, moveAdultContentToEnd } from '../../utils/adult-content-order';

export interface AuroraCategoryOption {
    /** Original provider ID, or exact M3U group title. Never replace with a synthetic parent ID. */
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

export function categoryGroupParts(label: string): { parent: string; child: string } {
    // Only explicit IPTV category separators create a hierarchy.
    // Do not split category titles containing a slash, dash or ordinary space.
    const match = /^(.*?)\s*[|｜]\s*(.+)$/.exec(label.trim());
    return match
        ? { parent: match[1].trim() || 'Outros', child: match[2].trim() || 'Todos' }
        : { parent: label.trim() || 'Sem categoria', child: 'Todos' };
}

export function buildAuroraLiveGroups(items: readonly AuroraCategoryOption[]): AuroraLiveGroup[] {
    const map = new Map<string, AuroraLiveGroup>();
    // Group by normalized root title, but keep exact original child IDs.
    for (const item of items) {
        const { parent, child } = categoryGroupParts(item.title);
        const key = parent.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim().toLocaleLowerCase('pt-BR');
        let group = map.get(key);
        if (!group) {
            group = { key, title: parent, count: 0, children: [] };
            map.set(key, group);
        }
        if (item.count == null || group.count == null) group.count = undefined;
        else group.count += item.count;
        group.children.push({ ...item, subtitle: child });
    }
    const groups = [...map.values()];
    for (const group of groups) {
        group.children = moveAdultContentToEnd(group.children, item =>
            isAdultContentLabel(item.subtitle) || isAdultContentLabel(item.title)
        );
    }
    return moveAdultContentToEnd(groups, group =>
        isAdultContentLabel(group.title) ||
        group.children.every(child => isAdultContentLabel(child.title))
    );
}

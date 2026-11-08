import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { catalogCategoryWidth } from '../../utils/catalog-column-width';
import { isAdultContentLabel, moveAdultContentToEnd } from '../../utils/adult-content-order';
import { AuroraCategoryOption, buildAuroraLiveGroups } from './aurora-category-model';

@Component({
    selector: 'app-aurora-catalog-navigation',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIcon],
    templateUrl: './aurora-catalog-navigation.component.html',
    styleUrls: ['./aurora-catalog-navigation.component.scss'],
})
export class AuroraCatalogNavigationComponent {
    readonly mode = input<'live' | 'library'>('library');
    readonly categories = input<readonly AuroraCategoryOption[]>([]);
    readonly selectedId = input<string | number | null | undefined>(null);
    readonly categorySelected = output<string>();

    readonly query = signal('');
    readonly searchOpen = signal(false);
    readonly rootOverride = signal<string | null>(null);

    readonly orderedCategories = computed(() =>
        moveAdultContentToEnd(this.categories(), option => isAdultContentLabel(option.title))
    );
    readonly groups = computed(() => buildAuroraLiveGroups(this.orderedCategories()));
    readonly selectedGroup = computed(() => {
        const id = this.selectedId();
        const groups = this.groups();
        // Respect a real provider selection before remembering manual navigation.
        const byId = id == null ? undefined : groups.find(group =>
            group.children.some(child => child.id === String(id))
        );
        if (byId) return byId;
        return groups.find(group => group.key === this.rootOverride()) ?? groups[0] ?? null;
    });
    readonly visibleGroups = computed(() => {
        const query = this.query().trim().toLocaleLowerCase();
        if (!query) return this.groups();
        return this.groups().filter(group =>
            group.title.toLocaleLowerCase().includes(query) ||
            group.children.some(child => child.subtitle.toLocaleLowerCase().includes(query) ||
                child.title.toLocaleLowerCase().includes(query))
        );
    });
    readonly visibleCategories = computed(() => {
        const query = this.query().trim().toLocaleLowerCase();
        return query ? this.orderedCategories().filter(category =>
            category.title.toLocaleLowerCase().includes(query)
        ) : this.orderedCategories();
    });
    readonly currentChildren = computed(() => {
        const group = this.selectedGroup();
        const query = this.query().trim().toLocaleLowerCase();
        if (!group) return [];
        // Selecting a parent always exposes all of its child categories.
        // While searching, show matching child entries or all children of a matching parent.
        return query && !group.title.toLocaleLowerCase().includes(query)
            ? group.children.filter(child =>
                child.subtitle.toLocaleLowerCase().includes(query) ||
                child.title.toLocaleLowerCase().includes(query))
            : group.children;
    });
    readonly firstColumnWidth = computed(() => catalogCategoryWidth(
        this.mode() === 'live'
            ? this.groups().map(group => group.title + ' (' + (group.count ?? '') + ')')
            : this.categories().map(cat => cat.title + ' (' + (cat.count ?? '') + ')'),
        84
    ));
    readonly secondColumnWidth = computed(() => catalogCategoryWidth(
        this.groups().flatMap(group => group.children.map(child =>
            child.subtitle + ' (' + (child.count ?? '') + ')'
        )), 84
    ));
    isSelected(id: string): boolean {
        return String(this.selectedId() ?? '') === id;
    }

    readonly allSelected = computed(() =>
        this.selectedId() == null || this.selectedId() === '' || this.selectedId() === '*'
    );

    chooseGroup(key: string): void {
        const group = this.groups().find(group => group.key === key);
        if (!group) return;
        this.rootOverride.set(key);
        // Selecting the parent picks its first real provider subcategory.
        // There is no synthesized category ID that remote APIs could reject.
        const child = group.children[0];
        if (child) this.categorySelected.emit(child.id);
    }

    chooseChild(id: string): void {
        this.categorySelected.emit(id);
    }
}

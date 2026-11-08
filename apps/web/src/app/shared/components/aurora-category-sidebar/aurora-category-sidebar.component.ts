import { adultsLast, columnWidthForLabels } from '../../utils/aurora-category-order';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export interface AuroraSidebarCategory {
    /** Stable, provider-specific category identifier. */
    id: string;
    name: string;
    count?: number;
}

/**
 * Shared Aurora category navigation for M3U, Xtream and Stalker playlists.
 * A playlist adapter supplies labels and IDs; presentation never depends on
 * the import type. Category selection stays in the owning store.
 */
@Component({
    selector: 'app-aurora-category-sidebar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[style.--aurora-sidebar-width.px]': 'columnWidth()' },
    imports: [MatIcon],
    templateUrl: './aurora-category-sidebar.component.html',
    styleUrl: './aurora-category-sidebar.component.scss',
})
export class AuroraCategorySidebarComponent {
    readonly categories = input.required<AuroraSidebarCategory[]>();
    readonly selectedId = input<string | null>(null);
    readonly heading = input('Categorias');
    readonly showManage = input(false);
    readonly categorySelected = output<string | null>();
    readonly manageClicked = output<void>();

    readonly search = signal('');
    readonly orderedCategories = computed(() =>
        adultsLast(this.categories(), (category) => category.name)
    );
    readonly columnWidth = computed(() =>
        columnWidthForLabels(this.categories().map((category) =>
            category.name + (category.count === undefined ? '' : ` (${category.count})`)
        ))
    );
    readonly filtered = computed(() => {
        const query = this.search().trim().toLocaleLowerCase();
        if (!query) return this.orderedCategories();
        return this.orderedCategories().filter((category) =>
            category.name.toLocaleLowerCase().includes(query)
        );
    });

    select(id: string | null): void {
        this.categorySelected.emit(id);
    }

    clearSearch(): void {
        this.search.set('');
    }
}

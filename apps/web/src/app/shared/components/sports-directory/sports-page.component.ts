import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StalkerStore } from '../../../stalker/stalker.store';
import { XtreamStore } from '../../../xtream-tauri/stores/xtream.store';
import { SportsDirectoryComponent } from './sports-directory.component';
import { SportsSource } from './sports-directory.model';

@Component({
    selector: 'app-sports-page',
    standalone: true,
    imports: [SportsDirectoryComponent],
    template: `<app-sports-directory
        [sources]="sportsCategories()"
        [loading]="isLoading()"
        (chosen)="openCompetition($event)" />`,
    styles: [':host { display: block; height: 100%; width: 100%; min-width: 0; overflow: hidden; }'],
})
export class SportsPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly xtream = inject(XtreamStore, { optional: true });
    private readonly stalker = inject(StalkerStore, { optional: true });
    readonly provider = this.route.snapshot.data['provider'] as 'xtream' | 'stalker';

    readonly sportsCategories = computed<SportsSource[]>(() => {
        if (this.provider === 'stalker') {
            return (this.stalker?.getCategoryResource() || []).filter(category =>
                category.category_id !== '*'
            ).map(category => ({
                id: String(category.category_id),
                title: category.category_name || '',
            }));
        }
        return (this.xtream?.liveCategories() || []).map(category => ({
            id: String(category.category_id ?? category.id),
            title: category.category_name || '',
        }));
    });

    readonly isLoading = computed(() => this.provider === 'stalker'
        ? !!this.stalker?.isCategoryResourceLoading()
        : !!this.xtream?.isLoadingCategories()
    );

    constructor() {
        // Stalker loads live categories lazily. Entering Sports must fetch its
        // actual live category list; never display movies as competitions.
        if (this.provider === 'stalker') {
            this.stalker?.setSelectedContentType('itv');
        }
    }

    openCompetition(categoryId: string): void {
        if (this.provider === 'stalker') {
            this.stalker?.setSelectedCategory(categoryId);
            this.stalker?.setPage(0);
            this.router.navigate(['../itv'], { relativeTo: this.route });
            return;
        }
        const id = Number(categoryId);
        if (!Number.isFinite(id)) return;
        this.xtream?.setSelectedContentType('live');
        this.xtream?.setSelectedCategory(id);
        this.router.navigate(['../live'], { relativeTo: this.route });
    }
}

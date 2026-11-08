import { Component, computed, input, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { organizeSports, SportsSource } from './sports-directory.model';

@Component({
    selector: 'app-sports-directory',
    standalone: true,
    imports: [MatIcon],
    templateUrl: './sports-directory.component.html',
    styleUrls: ['./sports-directory.component.scss'],
})
export class SportsDirectoryComponent {
    readonly sources = input<readonly SportsSource[]>([]);
    readonly loading = input(false);
    readonly chosen = output<string>();
    readonly search = signal('');
    readonly expanded = signal<string[]>(['Futebol','Automobilismo','Basquete','Vôlei']);
    readonly sections = computed(() => {
        const term = this.search().trim().toLocaleLowerCase();
        return organizeSports(this.sources()).map(section => ({
            ...section,
            entries: term ? section.entries.filter(item =>
                item.title.toLocaleLowerCase().includes(term) ||
                item.competition.toLocaleLowerCase().includes(term) ||
                section.title.toLocaleLowerCase().includes(term)
            ) : section.entries,
        })).filter(section => section.entries.length);
    });
    isExpanded(name: string): boolean {
        return !!this.search() || this.expanded().includes(name);
    }
    toggle(name: string): void {
        this.expanded.update(items =>
            items.includes(name) ? items.filter(item => item !== name) : [...items,name]
        );
    }
}

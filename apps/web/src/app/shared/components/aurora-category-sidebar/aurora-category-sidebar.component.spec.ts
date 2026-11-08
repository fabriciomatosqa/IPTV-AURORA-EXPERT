import { TestBed } from '@angular/core/testing';
import { AuroraCategorySidebarComponent } from './aurora-category-sidebar.component';

describe('AuroraCategorySidebarComponent provider-neutral navigation', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [AuroraCategorySidebarComponent],
        });
    });

    it('renders identical category controls for M3U and Xtream identifiers', () => {
        const fixture = TestBed.createComponent(AuroraCategorySidebarComponent);
        fixture.componentRef.setInput('categories', [
            { id: '17', name: 'Drama', count: 180 },
            { id: 'series-netflix', name: 'Netflix', count: 66 },
        ]);
        fixture.componentRef.setInput('selectedId', '17');
        fixture.detectChanges();
        const host: HTMLElement = fixture.nativeElement;
        expect(host.querySelectorAll('.aurora-category-item')).toHaveLength(2);
        expect(host.querySelector('.aurora-category-item.selected')?.getAttribute('data-category-id'))
            .toBe('17');
        expect(host.querySelector('.aurora-category-item small')?.textContent).toContain('180');
        expect(host.querySelector('.aurora-category-all')).toBeTruthy();
    });

    it('supports searching and selecting a category without replacing the sidebar', () => {
        const fixture = TestBed.createComponent(AuroraCategorySidebarComponent);
        fixture.componentRef.setInput('categories', [
            { id: '1', name: 'Aventura' },
            { id: '2', name: 'Documentários' },
        ]);
        const selected: Array<string | null> = [];
        fixture.componentInstance.categorySelected.subscribe((id) => selected.push(id));
        fixture.detectChanges();
        const host: HTMLElement = fixture.nativeElement;
        const input = host.querySelector('input[aria-label="Pesquisar categorias"]') as HTMLInputElement;
        input.value = 'doc';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        const categories = host.querySelectorAll('.aurora-category-item');
        expect(categories).toHaveLength(1);
        expect(categories[0].textContent).toContain('Documentários');
        (categories[0] as HTMLButtonElement).click();
        (host.querySelector('.aurora-category-all') as HTMLButtonElement).click();
        expect(selected).toEqual(['2', null]);
        expect(host.querySelector('app-aurora-category-sidebar')).toBeNull();
        expect(host.querySelector('.aurora-sidebar-heading')?.textContent).toContain('Categorias');
    });
});

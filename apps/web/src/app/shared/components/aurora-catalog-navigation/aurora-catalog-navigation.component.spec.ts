import { TestBed } from '@angular/core/testing';
import { AuroraCatalogNavigationComponent } from './aurora-catalog-navigation.component';

describe('one Aurora category navigator for all playlist sources', () => {
    const build = (mode: 'live' | 'library', hasSubcategories: boolean) => {
        TestBed.configureTestingModule({
            imports: [AuroraCatalogNavigationComponent],
        });
        const fixture = TestBed.createComponent(AuroraCatalogNavigationComponent);
        fixture.componentRef.setInput('mode', mode);
        fixture.componentRef.setInput('hasSubcategories', hasSubcategories);
        fixture.componentRef.setInput('categories', [
            { id: '10', title: 'GLOBO | CAPITAIS', count: 89 },
            { id: '11', title: 'GLOBO | REGIONAIS', count: 287 },
        ]);
        fixture.detectChanges();
        return fixture;
    };

    it('renders ORIGINAL Xtream and Stalker category names without a synthetic subcategory', () => {
        const fixture = build('live', false);
        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelectorAll('.aurora-category-column [data-category-id]')).toHaveLength(2);
        expect(root.querySelector('.aurora-subcategory-column')).toBeNull();
        expect(root.textContent).toContain('GLOBO | CAPITAIS');
        expect(root.textContent).toContain('GLOBO | REGIONAIS');
        const selected = jest.fn();
        fixture.componentInstance.categorySelected.subscribe(selected);
        (root.querySelector('[data-category-id="11"]') as HTMLButtonElement).click();
        expect(selected).toHaveBeenCalledWith('11');
    });

    it('shows Canais then the original M3U groups in a SECOND column', () => {
        const fixture = build('live', true);
        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelectorAll('.aurora-category-column [data-root-key]')).toHaveLength(1);
        expect(root.querySelector('.aurora-category-column')?.textContent).toContain('Canais');
        expect(root.querySelectorAll('.aurora-subcategory-column [data-category-id]')).toHaveLength(2);
        expect(root.querySelector('.aurora-subcategory-column')?.textContent).toContain('GLOBO | CAPITAIS');
        const selected = jest.fn();
        fixture.componentInstance.categorySelected.subscribe(selected);
        (root.querySelector('.aurora-subcategory-column [data-category-id="10"]') as HTMLButtonElement).click();
        expect(selected).toHaveBeenCalledWith('10');
    });

    it('keeps the same categories/search structure for movies and series', () => {
        const fixture = build('library', false);
        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelector('input[aria-label="Pesquisar categorias"]')).toBeTruthy();
        expect(root.querySelector('.aurora-all-categories')).toBeTruthy();
        expect(root.querySelectorAll('.aurora-category-column [data-category-id]')).toHaveLength(2);
        expect(root.querySelector('.aurora-subcategory-column')).toBeNull();
    });
});

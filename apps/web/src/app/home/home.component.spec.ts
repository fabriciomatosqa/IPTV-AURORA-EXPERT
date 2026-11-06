import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HomeComponent } from './home.component';
import { AddPlaylistDialogComponent } from '../shared/components/add-playlist/add-playlist-dialog.component';

describe('HomeComponent', () => {
    let component: HomeComponent;
    const dialog = { open: jest.fn() };

    beforeEach(() => {
        dialog.open.mockClear();
        TestBed.configureTestingModule({
            providers: [{ provide: MatDialog, useValue: dialog }],
        });
        component = TestBed.runInInjectionContext(() => new HomeComponent());
    });

    it('updates the search query used to filter playlists', () => {
        component.onSearchQueryChange('Aurora');
        expect(component.searchQuery()).toBe('Aurora');
        component.onSearchQueryChange('');
        expect(component.searchQuery()).toBe('');
    });

    it('opens the selected playlist import flow', () => {
        component.onAddPlaylist('url');
        expect(dialog.open).toHaveBeenCalledWith(AddPlaylistDialogComponent, {
            width: '600px',
            data: { type: 'url' },
        });
    });

    it('opens global search and recent content with their distinct contexts', () => {
        component.openGlobalSearch();
        expect(dialog.open).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({
                data: { isGlobalSearch: true },
                width: '100%',
                height: '100%',
            })
        );
        component.openGlobalRecent();
        expect(dialog.open).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({
                data: { isGlobal: true },
                hasBackdrop: true,
                disableClose: false,
            })
        );
    });
});

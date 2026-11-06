import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { PlaylistActions } from 'm3u-state';
import { Subject, of } from 'rxjs';
import { DataService, EpgService } from 'services';
import { AUTO_UPDATE_PLAYLISTS, STORE_KEY, Theme } from 'shared-interfaces';
import { AppComponent } from './app.component';
import { SettingsService } from './services/settings.service';

describe('AppComponent startup contracts', () => {
    let component: AppComponent;
    let actions: Subject<unknown>;
    let store: { dispatch: jest.Mock; select: jest.Mock };
    let settings: {
        getValueFromLocalStorage: jest.Mock;
        changeTheme: jest.Mock;
        setValueToLocalStorage: jest.Mock;
    };
    let translate: {
        setDefaultLang: jest.Mock;
        use: jest.Mock;
        instant: jest.Mock;
    };
    let data: { isElectron: boolean; sendIpcEvent: jest.Mock };
    let router: { navigateByUrl: jest.Mock };

    beforeEach(() => {
        actions = new Subject();
        store = {
            dispatch: jest.fn(),
            select: jest.fn().mockReturnValue(of([])),
        };
        settings = {
            getValueFromLocalStorage: jest.fn().mockReturnValue(of({})),
            changeTheme: jest.fn(),
            setValueToLocalStorage: jest.fn(),
        };
        translate = {
            setDefaultLang: jest.fn(),
            use: jest.fn(),
            instant: jest.fn((key) => key),
        };
        data = { isElectron: false, sendIpcEvent: jest.fn() };
        router = { navigateByUrl: jest.fn() };
        TestBed.configureTestingModule({
            providers: [
                { provide: Actions, useValue: actions },
                { provide: Store, useValue: store },
                { provide: SettingsService, useValue: settings },
                { provide: TranslateService, useValue: translate },
                { provide: DataService, useValue: data },
                { provide: Router, useValue: router },
                { provide: MatDialog, useValue: { open: jest.fn() } },
                { provide: MatSnackBar, useValue: { open: jest.fn() } },
                { provide: EpgService, useValue: { fetchEpg: jest.fn() } },
            ],
        });
        component = TestBed.runInInjectionContext(() => new AppComponent());
    });

    afterEach(() => actions.complete());

    it('loads playlists and initializes a fallback language on startup', () => {
        component.ngOnInit();
        expect(store.dispatch).toHaveBeenCalledWith(
            PlaylistActions.loadPlaylists()
        );
        expect(translate.setDefaultLang).toHaveBeenCalledWith(
            expect.any(String)
        );
        expect(settings.getValueFromLocalStorage).toHaveBeenCalledWith(
            STORE_KEY.Settings
        );
    });

    it('preserves an explicitly selected language and theme', () => {
        settings.getValueFromLocalStorage.mockReturnValue(
            of({ language: 'es', theme: Theme.LightTheme })
        );
        component.initSettings();
        expect(translate.use).toHaveBeenCalledWith('es');
        expect(settings.changeTheme).toHaveBeenCalledWith(Theme.LightTheme);
    });

    it('auto-refreshes only opted-in playlists once after playlists load', () => {
        const enabled = { id: 'enabled', autoRefresh: true };
        store.select.mockReturnValue(
            of([enabled, { id: 'manual', autoRefresh: false }])
        );
        component.ngOnInit();
        actions.next(PlaylistActions.loadPlaylistsSuccess({ playlists: [] }));
        actions.next(PlaylistActions.loadPlaylistsSuccess({ playlists: [] }));
        expect(data.sendIpcEvent).toHaveBeenCalledTimes(1);
        expect(data.sendIpcEvent).toHaveBeenCalledWith(AUTO_UPDATE_PLAYLISTS, [
            enabled,
        ]);
    });

    it('does not refresh playlists without opt-in', () => {
        store.select.mockReturnValue(
            of([{ id: 'manual', autoRefresh: false }])
        );
        component.ngOnInit();
        actions.next(PlaylistActions.loadPlaylistsSuccess({ playlists: [] }));
        expect(data.sendIpcEvent).not.toHaveBeenCalled();
    });

    it('navigates to the requested route', () => {
        component.navigateToRoute('/settings');
        expect(router.navigateByUrl).toHaveBeenCalledWith('/settings');
    });
});

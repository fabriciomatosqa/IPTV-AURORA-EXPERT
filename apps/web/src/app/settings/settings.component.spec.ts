import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { DialogService } from 'components';
import { of } from 'rxjs';
import { DataService, EpgService, PlaylistsService } from 'services';
import { Language, Theme, VideoPlayer } from 'shared-interfaces';
import { SettingsStore } from '../services/settings-store.service';
import { SettingsService } from '../services/settings.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent saved preferences', () => {
    let component: SettingsComponent;
    let settingsStore: {
        getSettings: jest.Mock;
        loadSettings: jest.Mock;
        updateSettings: jest.Mock;
    };
    let settingsService: {
        getAppVersion: jest.Mock;
        isVersionOutdated: jest.Mock;
        changeTheme: jest.Mock;
    };
    let data: { getAppEnvironment: jest.Mock; getAppVersion: jest.Mock };
    let translate: { use: jest.Mock; instant: jest.Mock };
    let epg: { fetchEpg: jest.Mock };
    let router: { navigateByUrl: jest.Mock };
    let dialog: { closeAll: jest.Mock };

    beforeEach(() => {
        settingsStore = {
            getSettings: jest.fn().mockReturnValue({
                player: VideoPlayer.ArtPlayer,
                language: Language.PORTUGUESE,
                theme: Theme.DarkTheme,
                remoteControlPort: 8876,
            }),
            loadSettings: jest.fn().mockResolvedValue(undefined),
            updateSettings: jest.fn().mockResolvedValue(undefined),
        };
        settingsService = {
            getAppVersion: jest.fn().mockReturnValue(of(null)),
            isVersionOutdated: jest.fn().mockReturnValue(false),
            changeTheme: jest.fn(),
        };
        data = {
            getAppEnvironment: jest.fn().mockReturnValue('electron'),
            getAppVersion: jest.fn().mockReturnValue('1.1.2'),
        };
        translate = { use: jest.fn(), instant: jest.fn((key: string) => key) };
        epg = { fetchEpg: jest.fn() };
        router = { navigateByUrl: jest.fn() };
        dialog = { closeAll: jest.fn() };
        TestBed.configureTestingModule({
            providers: [
                FormBuilder,
                { provide: SettingsStore, useValue: settingsStore },
                { provide: SettingsService, useValue: settingsService },
                { provide: DataService, useValue: data },
                { provide: TranslateService, useValue: translate },
                { provide: EpgService, useValue: epg },
                { provide: Router, useValue: router },
                { provide: MatDialog, useValue: dialog },
                { provide: MatSnackBar, useValue: { open: jest.fn() } },
                { provide: Store, useValue: { select: () => of(false) } },
                { provide: DialogService, useValue: {} },
                { provide: PlaylistsService, useValue: {} },
            ],
        });
        component = TestBed.runInInjectionContext(
            () => new SettingsComponent()
        );
    });

    it('waits for stored preferences and patches the form before displaying them', async () => {
        await component.ngOnInit();
        expect(settingsStore.loadSettings).toHaveBeenCalledTimes(1);
        expect(component.settingsForm.value).toEqual(
            expect.objectContaining(settingsStore.getSettings())
        );
        expect(component.version).toBe('1.1.2');
    });

    it('delegates version comparison and shows the result', () => {
        settingsService.isVersionOutdated.mockReturnValue(true);
        component.showVersionInformation('1.2.0');
        expect(settingsService.isVersionOutdated).toHaveBeenCalledWith(
            '1.1.2',
            '1.2.0'
        );
        expect(component.updateMessage).toBe(
            'SETTINGS.NEW_VERSION_AVAILABLE: 1.2.0'
        );
        settingsService.isVersionOutdated.mockReturnValue(false);
        component.showVersionInformation('1.1.2');
        expect(component.updateMessage).toBe('SETTINGS.LATEST_VERSION');
    });

    it('persists changes before applying language and theme', async () => {
        component.setSettings();
        component.settingsForm.patchValue({
            language: Language.SPANISH,
            theme: Theme.LightTheme,
        });
        component.onSubmit();
        expect(settingsStore.updateSettings).toHaveBeenCalledWith(
            component.settingsForm.value
        );
        expect(translate.use).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(translate.use).toHaveBeenCalledWith(Language.SPANISH);
        expect(settingsService.changeTheme).toHaveBeenCalledWith(
            Theme.LightTheme
        );
    });

    it('requests an EPG refresh for the supplied source', () => {
        component.refreshEpg('https://example.test/guide.xml');
        expect(epg.fetchEpg).toHaveBeenCalledWith([
            'https://example.test/guide.xml',
        ]);
    });

    it('returns to home or closes a dialog according to the current context', () => {
        component.backToHome();
        expect(router.navigateByUrl).toHaveBeenCalledWith('/');
        component.isDialog = true;
        component.backToHome();
        expect(dialog.closeAll).toHaveBeenCalledTimes(1);
    });

    it('toggles only one remote-control QR code at a time', () => {
        component.toggleQrCode('192.0.2.1');
        expect(component.visibleQrCodeIp()).toBe('192.0.2.1');
        component.toggleQrCode('192.0.2.2');
        expect(component.visibleQrCodeIp()).toBe('192.0.2.2');
        component.toggleQrCode('192.0.2.2');
        expect(component.visibleQrCodeIp()).toBeNull();
    });
});

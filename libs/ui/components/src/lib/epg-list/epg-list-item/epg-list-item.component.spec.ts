import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { EpgProgram } from 'shared-interfaces';
import { EpgItemDescriptionComponent } from '../epg-item-description/epg-item-description.component';
import { EpgListItemComponent } from './epg-list-item.component';

const EPG_PROGRAM_ITEM: EpgProgram = {
    start: '2026-11-06T12:00:00Z',
    stop: '2026-11-06T13:00:00Z',
    channel: 'demo-channel',
    title: 'Demo program',
    desc: 'Fictional program for the EPG test.',
    category: 'Demo',
};

describe('EpgListItemComponent', () => {
    let component: EpgListItemComponent;
    let fixture: ComponentFixture<EpgListItemComponent>;
    const dialog = { open: jest.fn() };

    beforeEach(async () => {
        dialog.open.mockClear();
        await TestBed.configureTestingModule({
            imports: [EpgListItemComponent, TranslateModule.forRoot()],
            providers: [{ provide: MatDialog, useValue: dialog }],
        }).compileComponents();

        fixture = TestBed.createComponent(EpgListItemComponent);
        component = fixture.componentInstance;
        component.item = EPG_PROGRAM_ITEM;
        component.timeNow = '2026-11-06T12:30:00Z';
        fixture.detectChanges();
    });

    it('shows the current program as live', () => {
        expect(
            fixture.nativeElement.querySelector('.live')?.textContent
        ).toContain('live');
    });

    it('opens the details dialog with the selected program', () => {
        component.showDescription(EPG_PROGRAM_ITEM);
        expect(dialog.open).toHaveBeenCalledTimes(1);
        expect(dialog.open).toHaveBeenCalledWith(EpgItemDescriptionComponent, {
            data: EPG_PROGRAM_ITEM,
        });
    });
});

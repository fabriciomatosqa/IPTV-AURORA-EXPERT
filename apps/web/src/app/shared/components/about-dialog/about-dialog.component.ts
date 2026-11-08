import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    imports: [MatIconModule, TranslateModule],
    template: `
        <div mat-dialog-content>
            <img
                src="./assets/aurora/aurora.png"
                width="128"
                alt="IPTV AURORA EXPERT"
            /><br />
            <h2 mat-dialog-title>{{ 'ABOUT.TITLE' | translate }}</h2>
            <p>{{ 'ABOUT.DESCRIPTION' | translate }}</p>
            <p>{{ 'ABOUT.VERSION' | translate }}: {{ appVersion }}</p>
            <p>
                Baseado no projeto aberto
                <a
                    href="https://github.com/ThomasMcIntee/iptvmate"
                    target="_blank"
                    rel="noopener noreferrer"
                    >iptvmate</a
                >, de Thomas McIntee e colaboradores, e no IPTVnator de 4gray.
                Licença MIT. Avisos originais preservados na distribuição.
            </p>
            <p>
                <a
                    href="https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT"
                    target="_blank"
                    [title]="'ABOUT.GITHUB_TOOLTIP' | translate"
                    [attr.aria-label]="'ABOUT.GITHUB_TOOLTIP' | translate"
                    ><img
                        src="./assets/icons/github-light.png"
                        [title]="'ABOUT.GITHUB_TOOLTIP' | translate"
                        alt="GitHub" /></a
                >&nbsp;
                <a
                    href="https://twitter.com/intent/tweet?text=IPTV%20AURORA%20EXPERT&url=https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT"
                    [title]="'ABOUT.TWITTER_TOOLTIP' | translate"
                >
                    <img
                        height="32"
                        src="./assets/icons/twitter-light.png"
                        [title]="'ABOUT.TWITTER_TOOLTIP' | translate"
                        alt="Twitter"
                    />
                </a>
                <a
                    href="https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT#contribuicoes"
                    target="_blank"
                    [title]="'ABOUT.BUY_ME_A_COFFEE_TOOLTIP' | translate"
                    [attr.aria-label]="
                        'ABOUT.BUY_ME_A_COFFEE_TOOLTIP' | translate
                    "
                    ><mat-icon>local_cafe</mat-icon></a
                >
            </p>
        </div>
    `,
    styles: [
        `
            button {
                text-transform: uppercase;
            }

            a {
                color: #fff;
            }

            .mat-icon {
                font-size: 32px;
            }
        `,
    ],
})
export class AboutDialogComponent {
    public appVersion = inject<string>(MAT_DIALOG_DATA);
}

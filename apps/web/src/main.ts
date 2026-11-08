import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// A relative directory <base> makes Chromium resolve '#/...' to that
// directory instead of index.html. It renders until the first reload, when
// file:// navigation fails. Keep assets relative to the same entry file.
if (window.electron && window.location.protocol === 'file:') {
    document
        .querySelector('base')
        ?.setAttribute(
            'href',
            new URL('index.html', window.location.href).href
        );
}

if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    'serviceWorker' in navigator
) {
    void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
            Promise.all(
                registrations.map((registration) => registration.unregister())
            )
        )
        .catch(() => {
            // Ignore cleanup failures in development.
        });
}

bootstrapApplication(AppComponent, appConfig).catch((err) =>
    console.error(err)
);

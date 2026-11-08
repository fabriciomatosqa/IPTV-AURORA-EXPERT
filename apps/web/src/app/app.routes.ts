import { Routes } from '@angular/router';
import { stalkerRoutes } from './stalker/stalker.routes';
import { xtreamRoutes } from './xtream-tauri/xtream.routes';

export const routes: Routes = [
    {
        path: 'floating-player',
        loadComponent: () =>
            import('./xtream-tauri/player-dialog/floating-player.component').then(
                (c) => c.FloatingPlayerComponent
            ),
    },
    {
        path: '',
        loadComponent: () =>
            import('./home/home.component').then((c) => c.HomeComponent),
    },
    {
        path: 'listas',
        data: { playlistManager: true },
        loadComponent: () =>
            import('./home/home.component').then((c) => c.HomeComponent),
    },
    {
        path: 'playlists',
        loadComponent: () =>
            import('./home/video-player/video-player.component').then(
                (c) => c.VideoPlayerComponent
            ),
    },
    {
        path: 'iptv',
        loadComponent: () =>
            import('./home/video-player/video-player.component').then(
                (c) => c.VideoPlayerComponent
            ),
    },
    {
        path: 'playlists/:id',
        loadComponent: () =>
            import('./home/video-player/video-player.component').then(
                (c) => c.VideoPlayerComponent
            ),
    },
    {
        path: 'settings',
        loadComponent: () =>
            import('./settings/settings.component').then(
                (c) => c.SettingsComponent
            ),
    },
    // One canonical Xtream experience, independent of browser/Electron routing.
    // Do not register the old alternate category-only screen.
    ...xtreamRoutes,
    {
        path: 'portals/:id',
        loadComponent: () =>
            import('./stalker/stalker-main-container.component').then(
                (c) => c.StalkerMainContainerComponent
            ),
    },
    ...stalkerRoutes,
    {
        path: '**',
        redirectTo: '',
    },
];

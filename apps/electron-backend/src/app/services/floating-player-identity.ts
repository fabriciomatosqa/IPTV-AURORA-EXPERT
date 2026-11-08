import type { BrowserWindow } from 'electron';

// Electron emits "browser-window-created" before a newly constructed
// BrowserWindow is returned, so identify our intentional PiP by its
// private webPreferences rather than an ID registered after construction.
export const FLOATING_PLAYER_MARKER = '--aurora-pip-player';

export function isAuroraFloatingPlayer(window: BrowserWindow): boolean {
    return (
        window.webContents.getLastWebPreferences()?.additionalArguments?.includes(
            FLOATING_PLAYER_MARKER
        ) === true
    );
}

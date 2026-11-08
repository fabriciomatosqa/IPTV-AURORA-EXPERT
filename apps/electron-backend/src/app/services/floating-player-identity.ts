import type { BrowserWindow } from 'electron';

// The IPC handler creates this window with a distinctive native title.
// Both application single-window guards allow only this deliberate exception.
export const FLOATING_PLAYER_MARKER = '--aurora-pip-player';
export const FLOATING_PLAYER_TITLE =
    'IPTV AURORA EXPERT — Picture in Picture';

export function isAuroraFloatingPlayer(window: BrowserWindow): boolean {
    return window.getTitle() === FLOATING_PLAYER_TITLE;
}

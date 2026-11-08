/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import axios from 'axios';
import { dialog, ipcMain } from 'electron';
import {
    createPlaylistObject,
    getFilenameFromUrl,
    parsePlaylistContent,
    playlistImportError,
} from 'm3u-utils';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { AUTO_UPDATE_PLAYLISTS, type Playlist } from 'shared-interfaces';

export default class PlaylistEvents {
    static bootstrapPlaylistEvents(): Electron.IpcMain {
        return ipcMain;
    }
}

const https = require('https');

/**
 * Fetches and parses a playlist from a URL
 * @param url - The URL to fetch the playlist from
 * @param title - Optional title for the playlist
 * @returns Parsed playlist object
 */
async function fetchPlaylistFromUrl(
    url: string,
    title?: string
): Promise<Playlist> {
    try {
        const parsedUrl = new URL(url.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol))
            throw new Error();
        url = parsedUrl.toString();
    } catch {
        throw playlistImportError('INVALID_URL');
    }

    const agent = new https.Agent({ rejectUnauthorized: false });
    let body: string;
    let sourceUrl = url;
    try {
        // IPTV providers can reject the default axios user agent or return
        // an HTML login/error page. Handle these cases before parsing.
        const response = await axios.get<string>(url, {
            httpsAgent: agent,
            responseType: 'text',
            timeout: 90000,
            maxRedirects: 5,
            headers: {
                Accept: '*/*',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
        });
        body = response.data;
        sourceUrl = response.request?.res?.responseUrl || url;
    } catch (error) {
        // Axios errors can include the complete URL (including IPTV account
        // credentials). Only expose a safe status or connection error.
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status === 401 || status === 403)
                throw playlistImportError('AUTH');
            if (status === 404) throw playlistImportError('NOT_FOUND');
            if (status) {
                throw playlistImportError('HTTP');
            }
            if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                throw playlistImportError('DNS');
            }
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw playlistImportError('TIMEOUT');
            }
        }
        throw playlistImportError('CONNECTION');
    }

    const parsedPlaylist = parsePlaylistContent(body, sourceUrl);

    const extractedName = getFilenameFromUrl(url);
    const playlistName =
        !extractedName || extractedName === 'Untitled playlist'
            ? 'Lista IPTV'
            : extractedName;

    return createPlaylistObject(
        title ?? playlistName,
        parsedPlaylist,
        url,
        'URL'
    );
}

/**
 * Reads and parses a playlist from a file path
 * @param filePath - The path to the playlist file
 * @param title - Title for the playlist
 * @returns Parsed playlist object
 */
async function fetchPlaylistFromFile(
    filePath: string,
    title: string
): Promise<Playlist> {
    let fileContent: string;
    try {
        fileContent = await readFile(filePath, 'utf-8');
    } catch {
        throw playlistImportError('FILE');
    }
    const parsedPlaylist = parsePlaylistContent(fileContent);
    const playlistObject = createPlaylistObject(
        title,
        parsedPlaylist,
        filePath,
        'FILE'
    );
    return playlistObject;
}

ipcMain.handle('fetch-playlist-by-url', async (event, url, title?: string) => {
    try {
        return await fetchPlaylistFromUrl(url, title);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle(
    'update-playlist-from-file-path',
    async (event, filePath, title) => {
        try {
            return await fetchPlaylistFromFile(filePath, title);
        } catch (error) {
            throw error;
        }
    }
);

ipcMain.handle('open-playlist-from-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Playlists M3U', extensions: ['m3u', 'm3u8', 'txt'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (canceled || filePaths.length === 0) {
        console.log('User canceled file open dialog.');
        return null;
    }

    const filePath = filePaths[0];

    try {
        // Extract filename from path and remove extension for a clean title
        const filename = basename(filePath);
        const title =
            filename.replace(/\.(m3u8?|pls|txt)$/i, '') || 'from file';

        return await fetchPlaylistFromFile(filePath, title);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle(AUTO_UPDATE_PLAYLISTS, async (event, playlists) => {
    console.log(`Auto-updating ${playlists.length} playlist(s)...`);

    const updatedPlaylists = [];

    for (const playlist of playlists) {
        try {
            let playlistObject;

            if (playlist.importDate && playlist.url) {
                // Update from URL
                console.log('Updating IPTV playlist from its saved URL.');
                playlistObject = await fetchPlaylistFromUrl(
                    playlist.url,
                    playlist.title
                );
            } else if (playlist.filePath) {
                // Update from file path
                console.log('Updating IPTV playlist from saved file.');
                playlistObject = await fetchPlaylistFromFile(
                    playlist.filePath,
                    playlist.title
                );
            } else {
                console.warn(
                    'Skipping IPTV playlist: no URL or file path found.'
                );
                continue;
            }

            // Preserve user data when updating playlist
            updatedPlaylists.push({
                ...playlistObject,
                _id: playlist._id,
                autoRefresh: playlist.autoRefresh,
                favorites: playlist.favorites || [], // Preserve favorites
                userAgent: playlist.userAgent, // Preserve custom user agent
            });

            console.log('IPTV playlist update completed.');
        } catch (error) {
            console.warn(
                'Unable to refresh an IPTV playlist; credentials omitted.'
            );
            // Continue with other playlists even if one fails
        }
    }

    console.log(`Auto-update completed: ${updatedPlaylists.length} updated`);
    return updatedPlaylists;
});

ipcMain.handle('save-file-dialog', async (event, defaultPath, filters) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            defaultPath,
            filters: filters || [{ name: 'All Files', extensions: ['*'] }],
        });

        if (canceled || !filePath) {
            return null;
        }

        return filePath;
    } catch (error) {
        console.error('Error showing save dialog:', error);
        throw error;
    }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        await writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Error writing file:', error);
        throw error;
    }
});

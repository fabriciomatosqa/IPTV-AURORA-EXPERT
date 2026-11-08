/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import axios from 'axios';
import { dialog, ipcMain } from 'electron';
import { parse } from 'iptv-playlist-parser';
import { createPlaylistObject, getFilenameFromUrl } from 'm3u-utils';
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
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Endereço inválido: informe uma URL HTTP ou HTTPS.');
    }

    const agent = new https.Agent({ rejectUnauthorized: false });
    let body: string;
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
    } catch (error) {
        // Axios errors can include the complete URL (including IPTV account
        // credentials). Only expose a safe status or connection error.
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status) {
                throw new Error(`O servidor recusou a lista (HTTP ${status}).`);
            }
            if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                throw new Error('Domínio da lista não encontrado (DNS).');
            }
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw new Error('Tempo esgotado ao carregar a lista IPTV.');
            }
        }
        throw new Error('Não foi possível conectar ao servidor da lista IPTV.');
    }

    if (typeof body !== 'string' || !body.replace(/^\uFEFF/, '').trimStart().startsWith('#EXTM3U')) {
        throw new Error(
            'O endereço não retornou uma lista M3U válida. Verifique o acesso ao provedor.'
        );
    }

    let parsedPlaylist: ReturnType<typeof parse>;
    try {
        parsedPlaylist = parse(body.replace(/^\uFEFF/, ''));
    } catch {
        throw new Error('Não foi possível interpretar os dados da lista M3U.');
    }
    if (!parsedPlaylist.items?.length) {
        throw new Error(
            'O servidor respondeu, mas a lista M3U não contém canais ou conteúdos.'
        );
    }

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
    const fileContent = await readFile(filePath, 'utf-8');
    const parsedPlaylist = parse(fileContent);
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
        console.error('Error fetching playlist:', error);
        throw error;
    }
});

ipcMain.handle(
    'update-playlist-from-file-path',
    async (event, filePath, title) => {
        try {
            return await fetchPlaylistFromFile(filePath, title);
        } catch (error) {
            console.error('Error reading playlist from file:', error);
            throw error;
        }
    }
);

ipcMain.handle('open-playlist-from-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Playlists', extensions: ['m3u', 'm3u8', 'pls', 'txt'] },
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
        const title = filename.replace(/\.(m3u8?|pls|txt)$/i, '') || 'from file';

        return await fetchPlaylistFromFile(filePath, title);
    } catch (error) {
        console.error('Error reading or parsing the file:', error);
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
                console.log(
                    `Updating playlist "${playlist.title}" from URL: ${playlist.url}`
                );
                playlistObject = await fetchPlaylistFromUrl(
                    playlist.url,
                    playlist.title
                );
            } else if (playlist.filePath) {
                // Update from file path
                console.log(
                    `Updating playlist "${playlist.title}" from file: ${playlist.filePath}`
                );
                playlistObject = await fetchPlaylistFromFile(
                    playlist.filePath,
                    playlist.title
                );
            } else {
                console.warn(
                    `Skipping playlist "${playlist.title}": no URL or file path found`
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

            console.log(`Successfully updated playlist "${playlist.title}"`);
        } catch (error) {
            console.error(
                `Failed to update playlist "${playlist.title}":`,
                error
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
            filters: filters || [
                { name: 'All Files', extensions: ['*'] },
            ],
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

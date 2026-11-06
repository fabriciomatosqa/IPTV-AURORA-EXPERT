import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { isAbsolute, join } from 'path';

/** Shared by Electron, SQLite and the EPG worker. Never reads an upstream profile. */
export function getAppPaths() {
    const override = process.env.AURORA_DATA_DIR;
    if (override && !isAbsolute(override)) {
        throw new Error('AURORA_DATA_DIR must be an absolute path');
    }
    const root = override || join(homedir(), '.iptv-aurora-expert');
    return {
        root,
        databases: join(root, 'databases'),
        database: join(root, 'databases', 'aurora.db'),
        catalogs: join(root, 'catalogs'),
        cache: join(root, 'cache'),
        images: join(root, 'cache', 'images'),
        metadata: join(root, 'cache', 'metadata'),
        config: join(root, 'config'),
        favorites: join(root, 'favorites'),
        history: join(root, 'history'),
        downloads: join(root, 'downloads'),
        logs: join(root, 'logs'),
        profile: join(root, 'profile'),
    };
}

export function ensureAppDirectories(): ReturnType<typeof getAppPaths> {
    const paths = getAppPaths();
    for (const [key, directory] of Object.entries(paths)) {
        if (key !== 'database') mkdirSync(directory, { recursive: true });
    }
    return paths;
}

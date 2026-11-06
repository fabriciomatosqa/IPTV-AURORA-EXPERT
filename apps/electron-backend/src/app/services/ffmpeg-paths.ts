import { existsSync } from 'fs';
import { join } from 'path';

export function resolveFfmpegBinary(
    packaged: boolean,
    resourcesPath: string
): {
    binary: string | null;
    source: string;
} {
    if (packaged) {
        const binary = join(
            resourcesPath,
            'media',
            process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
        );
        if (!existsSync(binary)) {
            throw new Error(
                `Required bundled FFmpeg executable is missing: ${binary}`
            );
        }
        return { binary, source: 'bundled' };
    }

    // Development may use either installed provider. Neither is imported by a package.
    const candidates: { binary: string | null; source: string }[] = [];
    try {
        candidates.push({
            binary: require('ffmpeg-static'),
            source: 'ffmpeg-static',
        });
    } catch (error) {
        console.warn('Development ffmpeg-static could not be loaded:', error);
    }
    try {
        candidates.push({
            binary: require('@ffmpeg-installer/ffmpeg').path,
            source: '@ffmpeg-installer/ffmpeg',
        });
    } catch (error) {
        console.warn(
            'Development ffmpeg-installer could not be loaded:',
            error
        );
    }
    return (
        candidates.find(
            (candidate) => candidate.binary && existsSync(candidate.binary)
        ) ?? { binary: null, source: 'none' }
    );
}

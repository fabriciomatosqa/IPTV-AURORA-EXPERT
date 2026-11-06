import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveFfmpegBinary } from './ffmpeg-paths';

jest.mock('@ffmpeg-installer/ffmpeg', () => {
    throw 'Could not find ffmpeg executable';
});
jest.mock('ffmpeg-static', () => {
    throw new Error('Development dependency must not be loaded');
});

describe('packaged FFmpeg resources', () => {
    it('loads the explicit resource without importing development providers or using FFMPEG_BIN', () => {
        const root = mkdtempSync(join(tmpdir(), 'aurora-media-'));
        mkdirSync(join(root, 'media'));
        const binary = join(
            root,
            'media',
            process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
        );
        writeFileSync(binary, 'fixture');
        const saved = process.env.FFMPEG_BIN;
        process.env.FFMPEG_BIN = join(root, 'outside-development-binary');
        try {
            expect(resolveFfmpegBinary(true, root)).toEqual({
                binary,
                source: 'bundled',
            });
        } finally {
            if (saved === undefined) delete process.env.FFMPEG_BIN;
            else process.env.FFMPEG_BIN = saved;
        }
    });
    it('fails with an actionable Error if a required package resource is absent', () => {
        const root = mkdtempSync(join(tmpdir(), 'aurora-missing-media-'));
        expect(() => resolveFfmpegBinary(true, root)).toThrow(
            'Required bundled FFmpeg executable is missing:'
        );
    });
});

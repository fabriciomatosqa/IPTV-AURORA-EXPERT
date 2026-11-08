import {
    parseAuroraReleaseTag,
    selectAuroraUpdate,
    PublicGitHubRelease,
} from './aurora-release-channel';

const released = (
    tag: string,
    extra: Partial<PublicGitHubRelease> = {}
): PublicGitHubRelease => ({
    tag_name: tag,
    draft: false,
    prerelease: tag.startsWith('v0.'),
    assets: [
        { name: 'latest.yml' },
        { name: `iptv-aurora-expert-${tag.slice(1)}-windows-x64-setup.exe` },
    ],
    ...extra,
});

describe('Aurora public version labels and updater channels', () => {
    it('parses development, beta and stable releases without losing date', () => {
        expect(parseAuroraReleaseTag('v0.0.081126-01')).toEqual({
            tag: 'v0.0.081126-01',
            display: '0.0.081126-01',
            internal: '2026.1108.10001',
            stage: 'development',
        });
        expect(parseAuroraReleaseTag('v0.1.081126-01')?.internal)
            .toBe('2026.1108.20001');
        expect(parseAuroraReleaseTag('v1.0.081126-01')?.internal)
            .toBe('2026.1108.30001');
        expect(parseAuroraReleaseTag('v1.1.081126-01')).toBeNull();
        expect(parseAuroraReleaseTag('v0.1.311126-01')).toBeNull();
    });

    it('finds beta after the existing development installer', () => {
        const choice = selectAuroraUpdate(
            [
                released('v0.0.081126-01'),
                released('v0.1.081126-01'),
            ],
            '2026.1108.1',
            '0.0.081126-01'
        );
        expect(choice?.display).toBe('0.1.081126-01');
    });

    it('promotes beta installations to the definitive version', () => {
        const choice = selectAuroraUpdate(
            [
                released('v1.0.081126-01', { prerelease: false }),
                released('v0.1.081126-02'),
            ],
            '2026.1108.20001',
            '0.1.081126-01'
        );
        expect(choice?.display).toBe('1.0.081126-01');
    });

    it('does not offer beta or development builds to stable users', () => {
        const choice = selectAuroraUpdate(
            [
                released('v0.1.091126-01'),
                released('v0.0.091126-02'),
            ],
            '2026.1108.30001',
            '1.0.081126-01'
        );
        expect(choice).toBeNull();
    });

    it('sorts eligible releases by actual version rather than GitHub listing order', () => {
        const choice = selectAuroraUpdate(
            [
                released('v0.1.081126-01'),
                released('v0.1.081126-03'),
                released('v0.1.081126-02'),
            ],
            '2026.1108.10001',
            '0.0.081126-01'
        );
        expect(choice?.display).toBe('0.1.081126-03');
    });

    it('ignores drafts, incomplete releases and the currently installed public label', () => {
        const choice = selectAuroraUpdate(
            [
                released('v0.0.081126-01'),
                released('v0.1.081126-01', { draft: true }),
                released('v1.0.081126-01', {
                    assets: [{ name: 'only-setup.exe' }],
                }),
            ],
            '2026.1108.1',
            '0.0.081126-01'
        );
        expect(choice).toBeNull();
    });
});

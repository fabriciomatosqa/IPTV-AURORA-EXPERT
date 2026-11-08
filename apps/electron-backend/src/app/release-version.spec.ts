const { releaseVersion } = require('../../../../scripts/prepare-release.cjs');
const semver = require('semver');

describe('IPTV AURORA EXPERT release stages', () => {
    it('uses the requested development, beta and definitive labels', () => {
        expect(releaseVersion('2026-11-08', 1, 'development')).toEqual({
            display: '0.0.081126-01',
            internal: '2026.1108.10001',
            stage: 'development',
        });
        expect(releaseVersion('2026-11-08', 1, 'beta')).toEqual({
            display: '0.1.081126-01',
            internal: '2026.1108.20001',
            stage: 'beta',
        });
        expect(releaseVersion('2026-11-08', 1, 'stable')).toEqual({
            display: '1.0.081126-01',
            internal: '2026.1108.30001',
            stage: 'stable',
        });
    });

    it('increases internal versions across stages, daily builds, month and year', () => {
        const versions = [
            releaseVersion('2026-11-07', 1),
            releaseVersion('2026-11-07', 2),
            releaseVersion('2026-11-08', 1),
            releaseVersion('2026-11-08', 1, 'beta'),
            releaseVersion('2026-11-08', 1, 'stable'),
            releaseVersion('2026-12-01', 1),
            releaseVersion('2027-01-01', 1),
        ];
        let previous = '1.1.2';
        for (const version of versions) {
            expect(semver.gt(version.internal, previous)).toBe(true);
            expect(Number(version.internal.split('.')[2])).toBeLessThan(65536);
            previous = version.internal;
        }
    });

    it('can update historical 0.0.081126-01 installations', () => {
        expect(
            semver.gt(
                releaseVersion('2026-11-08', 1, 'beta').internal,
                '2026.1108.1'
            )
        ).toBe(true);
    });

    it('maintains independent sequence suffixes for each stage', () => {
        expect(releaseVersion('2026-11-08', 2, 'development').display)
            .toBe('0.0.081126-02');
        expect(releaseVersion('2026-11-08', 2, 'beta').display)
            .toBe('0.1.081126-02');
        expect(releaseVersion('2026-11-08', 2, 'stable').display)
            .toBe('1.0.081126-02');
    });

    it('rejects invalid dates, stages and sequence limits', () => {
        expect(() => releaseVersion('2026-02-30', 1)).toThrow();
        expect(() => releaseVersion('2026-11-07', 0)).toThrow();
        expect(() => releaseVersion('2026-11-07', 10000)).toThrow();
        expect(() => releaseVersion('2026-11-07', 1, 'unknown')).toThrow();
    });
});

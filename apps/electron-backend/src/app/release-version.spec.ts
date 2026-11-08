const { releaseVersion } = require('../../../../scripts/prepare-release.cjs');
const semver = require('semver');

describe('daily Aurora release ordering', () => {
    it('keeps the requested labels and a monotonic installer version across days and months', () => {
        const versions = [
            releaseVersion('2026-11-07', 1),
            releaseVersion('2026-11-07', 2),
            releaseVersion('2026-11-08', 1),
            releaseVersion('2026-12-01', 1),
            releaseVersion('2027-01-01', 1),
        ];
        expect(versions[0].display).toBe('0.0.071126-01');
        expect(versions[1].display).toBe('0.0.071126-02');
        expect(versions[2].display).toBe('0.0.081126-01');
        let previous = '1.1.2';
        for (const version of versions) {
            expect(semver.gt(version.internal, previous)).toBe(true);
            previous = version.internal;
        }
    });
    it('rejects impossible dates and invalid sequences', () => {
        expect(() => releaseVersion('2026-02-30', 1)).toThrow();
        expect(() => releaseVersion('2026-11-07', 0)).toThrow();
    });
});

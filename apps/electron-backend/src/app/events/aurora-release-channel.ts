/**
 * GitHub public release labels use:
 *   0.0.DDMMYY-NN (development)
 *   0.1.DDMMYY-NN (beta)
 *   1.0.DDMMYY-NN (stable)
 *
 * electron-updater/Windows require a monotonically increasing SemVer rather
 * than those display labels. Keep this mapping in sync with
 * scripts/prepare-release.cjs.
 */
export type AuroraReleaseStage = 'development' | 'beta' | 'stable';

const STAGES: Record<string, { stage: AuroraReleaseStage; rank: number }> = {
    '0.0': { stage: 'development', rank: 1 },
    '0.1': { stage: 'beta', rank: 2 },
    '1.0': { stage: 'stable', rank: 3 },
};

export interface AuroraReleaseInfo {
    tag: string;
    display: string;
    internal: string;
    stage: AuroraReleaseStage;
}

export interface PublicGitHubRelease {
    tag_name: string;
    draft?: boolean;
    prerelease?: boolean;
    assets?: Array<{ name: string }>;
}

export function parseAuroraReleaseTag(
    tag: string
): AuroraReleaseInfo | null {
    const match = /^v?(0\.0|0\.1|1\.0)\.(\d{2})(\d{2})(\d{2})-(\d{2,4})$/.exec(
        tag
    );
    if (!match) return null;
    const [, prefix, day, month, yearSuffix, sequenceString] = match;
    const year = 2000 + Number(yearSuffix);
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    const sequence = Number(sequenceString);
    const date = new Date(Date.UTC(year, monthNumber - 1, dayNumber));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== monthNumber ||
        date.getUTCDate() !== dayNumber ||
        sequence < 1 ||
        sequence > 9999
    ) {
        return null;
    }
    const stageInfo = STAGES[prefix];
    const display = `${prefix}.${day}${month}${yearSuffix}-${sequenceString}`;
    return {
        tag: `v${display}`,
        display,
        internal: `${year}.${Number(month + day)}.${stageInfo.rank * 10000 + sequence}`,
        stage: stageInfo.stage,
    };
}

function compareInternalVersions(a: string, b: string): number {
    const parts = (value: string) => {
        const matched = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
        return matched ? matched.slice(1).map(Number) : null;
    };
    const left = parts(a);
    const right = parts(b);
    if (!left || !right) return -1;
    for (let index = 0; index < 3; index++) {
        if (left[index] !== right[index]) {
            return left[index] > right[index] ? 1 : -1;
        }
    }
    return 0;
}

/** A stable installation must never be silently upgraded to a beta. */
function acceptsStage(
    current: AuroraReleaseStage,
    offered: AuroraReleaseStage
): boolean {
    if (current === 'stable') return offered === 'stable';
    if (current === 'beta') return offered !== 'development';
    return true;
}

/** Only releases with a valid updater manifest AND installer are usable. */
export function selectAuroraUpdate(
    releases: PublicGitHubRelease[],
    installedInternal: string,
    installedDisplay: string
): AuroraReleaseInfo | null {
    const installedStage =
        parseAuroraReleaseTag(installedDisplay)?.stage ?? 'development';
    const candidates = releases
        .filter(
            (release) =>
                !release.draft &&
                release.assets?.some((asset) => asset.name === 'latest.yml') &&
                release.assets?.some((asset) =>
                    /-windows-x64-setup\.exe$/.test(asset.name)
                )
        )
        .map((release) => parseAuroraReleaseTag(release.tag_name))
        .filter((release): release is AuroraReleaseInfo => Boolean(release))
        .filter(
            (release) =>
                release.display !== installedDisplay &&
                acceptsStage(installedStage, release.stage) &&
                compareInternalVersions(release.internal, installedInternal) > 0
        );
    candidates.sort((a, b) =>
        compareInternalVersions(b.internal, a.internal)
    );
    return candidates[0] ?? null;
}

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

// Public format: MAJOR.PHASE.DDMMYY-SEQUENCE
//   0.0 = development, 0.1 = beta, 1.0 = stable.
// The internal numeric version must increase across stages while remaining
// compatible with electron-updater, SemVer and Windows file-version limits.
// For a given date: development < beta < stable, even if the public suffix
// is the same (-01). Historical 2026.1108.1 packages can update to these.
const STAGES = Object.freeze({
    development: { prefix: '0.0', rank: 1 },
    beta: { prefix: '0.1', rank: 2 },
    stable: { prefix: '1.0', rank: 3 },
});

function releaseVersion(date, sequence, stage = 'development') {
    if (!Object.hasOwn(STAGES, stage))
        throw Error('Etapa inválida: use development, beta ou stable.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw Error('Use a data AAAA-MM-DD.');
    const parsed = new Date(date + 'T12:00:00Z');
    if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    )
        throw Error('Data inválida.');
    // Windows version segments must be <= 65535. The third segment is
    // 10000 * stage rank + sequence, hence the 9999 sequence limit.
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999)
        throw Error('Sequência inválida (1 a 9999).');
    const [year, month, day] = date.split('-');
    const { prefix, rank } = STAGES[stage];
    return {
        display: `${prefix}.${day}${month}${year.slice(-2)}-${String(sequence).padStart(2, '0')}`,
        internal: `${Number(year)}.${Number(month + day)}.${rank * 10000 + sequence}`,
        stage,
    };
}

function main() {
    const args = Object.fromEntries(
        process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('='))
    );
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    const date = args.date || today;
    const stage = args.stage || 'development';
    let sequence = args.sequence ? Number(args.sequence) : 1;
    if (!args.sequence) {
        const tags = execFileSync('git', ['ls-remote', '--tags', 'origin'], {
            cwd: root,
            encoding: 'utf8',
            windowsHide: true,
        });
        const prefix = releaseVersion(date, 1, stage).display.replace(/-01$/, '-');
        for (const line of tags.split('\n')) {
            const tag = line.split('refs/tags/')[1]?.replace(/^v/, '');
            if (
                tag?.startsWith(prefix) &&
                /^\d+$/.test(tag.slice(prefix.length))
            )
                sequence = Math.max(
                    sequence,
                    Number(tag.slice(prefix.length)) + 1
                );
        }
    }
    const version = releaseVersion(date, sequence, stage);
    for (const name of ['package.json', 'apps/electron-backend/package.json']) {
        const file = path.join(root, name);
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        json.version = version.internal;
        json.auroraVersion = version.display;
        json.auroraStage = version.stage;
        fs.writeFileSync(
            file,
            JSON.stringify(json, null, name === 'package.json' ? 2 : 4) + '\n'
        );
    }
    const configPath = path.join(root, 'electron-builder.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.win.artifactName =
        config.nsis.artifactName = `iptv-aurora-expert-${version.display}-windows-x64-setup.exe`;
    config.publish = {
        provider: 'generic',
        url: 'https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT/releases/latest/download',
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4) + '\n');
    const lockPath = path.join(root, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        lock.version = version.internal;
        if (lock.packages?.['']) lock.packages[''].version = version.internal;
        fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    }
    console.log(JSON.stringify(version));
}
module.exports = { releaseVersion, STAGES };
if (require.main === module) main();

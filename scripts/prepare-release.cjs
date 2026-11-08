const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function releaseVersion(date, sequence) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw Error('Use a data AAAA-MM-DD.');
    const parsed = new Date(date + 'T12:00:00Z');
    if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    )
        throw Error('Data inválida.');
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 65535)
        throw Error('Sequência inválida.');
    const [year, month, day] = date.split('-');
    return {
        display: `0.0.${day}${month}${year.slice(-2)}-${String(sequence).padStart(2, '0')}`,
        internal: `${Number(year)}.${Number(month + day)}.${sequence}`,
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
    let sequence = args.sequence ? Number(args.sequence) : 1;
    if (!args.sequence) {
        const tags = execFileSync('git', ['ls-remote', '--tags', 'origin'], {
            cwd: root,
            encoding: 'utf8',
            windowsHide: true,
        });
        const prefix = releaseVersion(date, 1).display.replace(/-01$/, '-');
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
    const version = releaseVersion(date, sequence);
    for (const name of ['package.json', 'apps/electron-backend/package.json']) {
        const file = path.join(root, name);
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        json.version = version.internal;
        json.auroraVersion = version.display;
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
module.exports = { releaseVersion };
if (require.main === module) main();

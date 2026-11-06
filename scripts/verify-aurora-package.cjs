const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');

module.exports = async function verifyPackage(context) {
    await require('electron-builder-sandbox-fix')(context);
    if (context.electronPlatformName !== 'win32') return;
    const resources = path.join(context.appOutDir, 'resources');
    const manifest = JSON.parse(
        fs.readFileSync(path.join(resources, 'media', 'manifest.json'), 'utf8')
    );
    const bundled = path.join(resources, 'media', manifest.executable);
    const hash = createHash('sha256')
        .update(fs.readFileSync(bundled))
        .digest('hex');
    if (hash !== manifest.sha256)
        throw new Error('Bundled FFmpeg integrity check failed');
    for (const file of [
        'workers/epg-parser.worker.js',
        'legal/LICENSE.md',
        'legal/THIRD_PARTY_NOTICES.md',
        'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
    ]) {
        if (!fs.existsSync(path.join(resources, file)))
            throw new Error(`Missing required packaged resource: ${file}`);
    }
    const builderRequire = createRequire(require.resolve('electron-builder'));
    const asar = createRequire(builderRequire.resolve('app-builder-lib'))(
        '@electron/asar'
    );
    const archive = path.join(resources, 'app.asar');
    for (const file of [
        'package.json',
        'electron-backend/main.js',
        'electron-backend/main.preload.js',
        'web/index.html',
        'remote-control-web/browser/index.html',
    ]) {
        asar.extractFile(archive, path.normalize(file));
    }
    const metadata = JSON.parse(asar.extractFile(archive, 'package.json'));
    if (
        metadata.name !== 'iptv-aurora-expert' ||
        metadata.main !== 'electron-backend/main.js'
    )
        throw new Error('Packaged application metadata is invalid');
    console.log(
        'PASS package: ASAR entry/preload/frontend/remote, FFmpeg SHA-256, SQLite native module, EPG worker and legal resources'
    );
};

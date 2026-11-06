const fs = require('node:fs');
const path = require('node:path');
const { build } = require('electron-builder');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

function prepareMedia(root) {
    const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const staticDir = path.dirname(
        require.resolve('ffmpeg-static/package.json')
    );
    const staticBinary = path.join(staticDir, executable);
    const source = fs.existsSync(staticBinary)
        ? 'ffmpeg-static'
        : '@ffmpeg-installer/ffmpeg';
    const binary =
        source === 'ffmpeg-static'
            ? staticBinary
            : require('@ffmpeg-installer/ffmpeg').path;
    if (!fs.existsSync(binary))
        throw new Error(`FFmpeg packaging prerequisite is absent: ${binary}`);
    const version = spawnSync(binary, ['-version'], {
        encoding: 'utf8',
        windowsHide: true,
    });
    if (version.status !== 0)
        throw new Error(`FFmpeg packaging probe failed: ${version.stderr}`);
    const directory = path.join(root, 'dist', 'aurora-media');
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(binary, path.join(directory, executable));
    fs.copyFileSync(
        path.join(staticDir, 'LICENSE'),
        path.join(directory, 'COPYING.GPLv3.txt')
    );
    const supplier = path.dirname(binary);
    for (const file of ['package.json', 'README.md']) {
        const sourceFile = path.join(supplier, file);
        if (fs.existsSync(sourceFile))
            fs.copyFileSync(
                sourceFile,
                path.join(directory, `supplier-${file}`)
            );
    }
    const manifest = {
        source,
        executable,
        sha256: createHash('sha256')
            .update(fs.readFileSync(binary))
            .digest('hex'),
        version: version.stdout.trim(),
    };
    fs.writeFileSync(
        path.join(directory, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n'
    );
    console.log(
        `Packaging verified ${source}: ${manifest.version.split('\n')[0]}`
    );
    return manifest;
}

async function main() {
    const root = path.resolve(__dirname, '..');
    for (const file of [
        'electron-backend/main.js',
        'electron-backend/main.preload.js',
        'electron-backend/workers/epg-parser.worker.js',
        'web/index.html',
        'remote-control-web/browser/index.html',
    ]) {
        if (!fs.existsSync(path.join(root, 'dist/apps', file)))
            throw new Error(
                `Missing build output: ${file}. Run pnpm nx build electron-backend --configuration=production first.`
            );
    }
    const config = JSON.parse(
        fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8')
    );
    const metadata = JSON.parse(
        fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    );
    const backendMetadata = JSON.parse(
        fs.readFileSync(
            path.join(root, 'apps/electron-backend/package.json'),
            'utf8'
        )
    );
    if (metadata.version !== backendMetadata.version)
        throw new Error('Root and Electron package versions must match.');
    prepareMedia(root);
    await build({
        projectDir: root,
        // Pass the file once: merging it with an identical object duplicates extraResources.
        config: path.join(root, 'electron-builder.json'),
        publish: 'never',
        ...(process.argv.includes('--dir') ? { dir: true } : {}),
    });
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});

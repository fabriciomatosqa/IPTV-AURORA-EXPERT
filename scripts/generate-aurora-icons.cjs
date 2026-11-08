// Preserve the user-supplied official artwork; only resize for platform icons.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
    const dir = path.resolve(__dirname, '../apps/web/src/assets/aurora');
    const source = path.join(dir, 'aurora-official.png');
    for (const size of [192, 256, 512, 1024]) {
        await sharp(source)
            .resize(size, size)
            .png()
            .toFile(path.join(dir, `aurora-${size}.png`));
    }
    fs.copyFileSync(
        path.join(dir, 'aurora-512.png'),
        path.join(dir, 'aurora.png')
    );
    const png = fs.readFileSync(path.join(dir, 'aurora-256.png'));
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    const ico = Buffer.concat([header, png]);
    fs.writeFileSync(path.join(dir, 'aurora.ico'), ico);
    // Angular's source favicon and Apple touch icon use the same original mark.
    fs.writeFileSync(path.resolve(dir, '../../favicon.ico'), ico);
    fs.writeFileSync(
        path.resolve(
            __dirname,
            '../apps/remote-control-web/public/favicon.ico'
        ),
        ico
    );
    const chunks = [256, 512, 1024].map((size, i) => {
        const image = fs.readFileSync(path.join(dir, `aurora-${size}.png`));
        const chunk = Buffer.alloc(8);
        chunk.write(['ic08', 'ic09', 'ic10'][i]);
        chunk.writeUInt32BE(image.length + 8, 4);
        return Buffer.concat([chunk, image]);
    });
    const icns = Buffer.alloc(8);
    icns.write('icns');
    icns.writeUInt32BE(8 + chunks.reduce((n, c) => n + c.length, 0), 4);
    fs.writeFileSync(
        path.join(dir, 'aurora.icns'),
        Buffer.concat([icns, ...chunks])
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

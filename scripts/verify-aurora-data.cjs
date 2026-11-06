// Runs the actual SQLite library with Electron's native ABI, in an isolated profile.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const out = path.resolve(__dirname, '../dist/aurora-data-verification');
fs.mkdirSync(out, { recursive: true });

async function verify() {
    const root = fs.mkdtempSync(path.join(out, 'profile-'));
    process.env.AURORA_DATA_DIR = root;
    const connection = require(path.join(out, 'connection.cjs'));
    const paths = require(path.join(out, 'paths.cjs'));
    const Database = require('better-sqlite3');
    assert.equal(
        connection.getDatabasePath(),
        path.join(root, 'databases', 'aurora.db')
    );
    for (const [key, p] of Object.entries(paths.getAppPaths())) {
        assert.ok(p.startsWith(root));
        if (key !== 'database') assert.ok(fs.statSync(p).isDirectory());
    }
    console.log('PASS independent paths and all data directories');

    await assert.rejects(connection.initDatabase({ readonly: true }));
    const [a, b] = await Promise.all([
        connection.initDatabase(),
        connection.initDatabase(),
    ]);
    assert.equal(a, b);
    connection.closeDatabase();
    console.log(
        'PASS failed initialization can retry; concurrent initialization shares connection'
    );

    let db = new Database(connection.getDatabasePath());
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    for (const table of [
        'playlists',
        'categories',
        'content',
        'favorites',
        'recently_viewed',
        'epg_channels',
        'epg_programs',
        'epg_programs_fts',
        'playback_positions',
        'downloads',
    ]) {
        assert.ok(
            db
                .prepare('SELECT name FROM sqlite_master WHERE name=?')
                .get(table),
            table
        );
    }
    assert.equal(
        db.pragma('table_info(categories)').filter((c) => c.name === 'hidden')
            .length,
        1
    );
    db.close();
    await connection.initDatabase();
    connection.closeDatabase();
    console.log('PASS fresh schema, FTS5, WAL and repeated hidden migration');

    process.env.AURORA_DATA_DIR = fs.mkdtempSync(
        path.join(out, 'legacy-schema-')
    );
    db = new Database(connection.getDatabasePath());
    db.exec(
        "CREATE TABLE categories(id INTEGER PRIMARY KEY,playlist_id TEXT,name TEXT,type TEXT,xtream_id INTEGER); INSERT INTO categories VALUES(1,'example','Ficticia','live',42)"
    );
    db.close();
    await connection.initDatabase();
    connection.closeDatabase();
    db = new Database(connection.getDatabasePath());
    assert.deepEqual(db.prepare('SELECT name,hidden FROM categories').get(), {
        name: 'Ficticia',
        hidden: 0,
    });
    db.close();
    await connection.initDatabase();
    connection.closeDatabase();
    console.log('PASS old schema gains hidden once and preserves data');

    process.env.AURORA_DATA_DIR = fs.mkdtempSync(
        path.join(out, 'broken-schema-')
    );
    db = new Database(connection.getDatabasePath());
    db.exec('CREATE TABLE categories(id INTEGER PRIMARY KEY)');
    db.close();
    await assert.rejects(connection.initDatabase());
    connection.closeDatabase();
    console.log(
        'PASS real schema errors propagate instead of being reported as already applied'
    );

    process.env.AURORA_DATA_DIR = 'relative-profile';
    assert.throws(() => paths.getAppPaths(), /absolute/);
    console.log('PASS relative profile override rejected');
}

if (process.argv.includes('--worker')) {
    verify().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
} else {
    const esbuild = require('esbuild');
    for (const [entry, name] of [
        ['connection', 'connection'],
        ['app-paths', 'paths'],
    ]) {
        esbuild.buildSync({
            entryPoints: [
                path.resolve(
                    __dirname,
                    `../libs/shared/database/src/lib/${entry}.ts`
                ),
            ],
            outfile: path.join(out, `${name}.cjs`),
            bundle: true,
            platform: 'node',
            format: 'cjs',
            external: ['better-sqlite3'],
        });
    }
    const result = spawnSync(require('electron'), [__filename, '--worker'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: 'inherit',
        windowsHide: true,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}

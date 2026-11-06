import type Database from 'better-sqlite3';

/** Inspect the schema before migrating; real I/O/schema errors must propagate. */
export function runMigrations(sqlite: Database.Database): void {
    sqlite.transaction(() => {
        const columns = sqlite.pragma('table_info(categories)') as {
            name: string;
        }[];
        if (!columns.some((column) => column.name === 'hidden')) {
            sqlite.exec(
                'ALTER TABLE categories ADD COLUMN hidden INTEGER DEFAULT 0'
            );
        }
    })();
}

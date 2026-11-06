import { appendFileSync } from 'fs';
import { join } from 'path';
import { inspect } from 'util';
import { ensureAppDirectories } from 'aurora-paths';

// This entry must execute before application imports (including native modules).
// Monitoring records errors without consuming Electron's fatal exception handling.
const paths = ensureAppDirectories();
const diagnosticFile = join(paths.logs, 'main-process.log');
const diagnosticFallback = console.error.bind(console);
function redact(text: string): string {
    return text
        .replace(/https?:\/\/[^\s'"<>]+/g, (value) => {
            try {
                const url = new URL(value);
                if (url.username) url.username = '[redacted]';
                if (url.password) url.password = '[redacted]';
                for (const key of [...url.searchParams.keys()]) {
                    if (
                        /user(name)?|pass(word)?|token|api.?key|auth|mac/i.test(
                            key
                        )
                    )
                        url.searchParams.set(key, '[redacted]');
                }
                const segments = url.pathname.split('/');
                if (
                    /^(live|movie|series)$/i.test(segments[1] || '') &&
                    segments.length > 4
                ) {
                    segments[2] = segments[3] = '[redacted]';
                    url.pathname = segments.join('/');
                }
                return url.toString();
            } catch {
                return value;
            }
        })
        .replace(
            /\b(username|password|token|authorization|apiKey|api_key)(\s*:\s*)(['"])[^'"\r\n]*\3/gi,
            '$1$2"[redacted]"'
        );
}
function record(stage: string, value: unknown): void {
    try {
        appendFileSync(
            diagnosticFile,
            `${new Date().toISOString()} ${stage}\n${redact(inspect(value, { depth: 8, colors: false }))}\n`
        );
    } catch (error) {
        // Diagnostics must not turn a console message into an application failure.
        diagnosticFallback(
            'Unable to append main-process diagnostic log:',
            error
        );
    }
}
record('bootstrap', {
    executable: process.execPath,
    resourcesPath: process.resourcesPath,
    cwd: process.cwd(),
    versions: process.versions,
    environment: Object.fromEntries(
        [
            'ELECTRON_RUN_AS_NODE',
            'ELECTRON_IS_DEV',
            'NODE_ENV',
            'NODE_OPTIONS',
            'NODE_PATH',
            'FFMPEG_BIN',
            'AURORA_DATA_DIR',
        ].map((key) => [key, process.env[key]])
    ),
});
for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
        record(`console:${level}`, args);
        original(...args);
    };
}
process.on('uncaughtExceptionMonitor', (error, origin) =>
    record(`uncaught:${origin}`, error)
);
try {
    require('./main');
} catch (error) {
    record('loading-main-failed', error);
    throw error;
}

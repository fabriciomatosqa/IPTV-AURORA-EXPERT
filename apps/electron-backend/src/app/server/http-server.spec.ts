import { createServer } from 'http';
import { HttpServer } from './http-server';

jest.mock('electron', () => ({ app: { getAppPath: () => process.cwd() } }));

describe('remote control port conflicts', () => {
    it('reports an occupied port without an unhandled error', async () => {
        const occupied = createServer();
        await new Promise<void>((resolve) => occupied.listen(0, resolve));
        const port = (occupied.address() as { port: number }).port;
        const remote = new HttpServer();
        const reported = new Promise<string>((resolve) => {
            jest.spyOn(console, 'error').mockImplementationOnce((message) => resolve(String(message)));
        });
        try {
            remote.start(port);
            expect(await reported).toContain('EADDRINUSE');
            remote.stop();
        } finally {
            await new Promise<void>((resolve) => occupied.close(() => resolve()));
            jest.restoreAllMocks();
        }
    });

    it('rejects an invalid configured port before listening', () => {
        expect(() => new HttpServer().updateSettings(true, 70000)).toThrow(RangeError);
    });
});

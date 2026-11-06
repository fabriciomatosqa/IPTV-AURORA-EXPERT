import type { Config } from 'drizzle-kit';
import { getAppPaths } from './libs/shared/database/src/lib/app-paths';

export default {
    schema: './libs/shared/database/src/lib/schema.ts',
    out: './apps/electron-backend/src/app/database/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: getAppPaths().database,
    },
} satisfies Config;

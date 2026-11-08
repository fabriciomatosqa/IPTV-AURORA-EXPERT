import packageJson from '@package';

export const AppConfig = {
    production: true,
    environment: 'PROD',
    version: packageJson.auroraVersion || packageJson.version,
    BACKEND_URL: 'http://localhost:3000',
};

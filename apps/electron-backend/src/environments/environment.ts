declare const __BUILD_VERSION__: string;
import packageJson from '@package';

export const environment = {
    production: false,
    version: packageJson.auroraVersion || __BUILD_VERSION__,
};

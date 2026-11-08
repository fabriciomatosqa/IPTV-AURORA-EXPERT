export interface AppUpdateState {
    phase:
        | 'idle'
        | 'checking'
        | 'available'
        | 'downloading'
        | 'ready'
        | 'up-to-date'
        | 'error'
        | 'unsupported';
    currentVersion: string;
    availableVersion?: string;
    percent?: number;
    message: string;
}

import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { AppUpdateState } from 'shared-interfaces';

@Injectable({ providedIn: 'root' })
export class AppUpdateService implements OnDestroy {
    readonly state = signal<AppUpdateState>({
        phase: 'idle',
        currentVersion: '',
        message: 'Verifique se existe uma nova versão.',
    });
    readonly busy = computed(() =>
        ['checking', 'downloading'].includes(this.state().phase)
    );
    private unsubscribe?: () => void;
    constructor() {
        this.unsubscribe = window.electron?.onAppUpdateState?.((state) =>
            this.state.set(state)
        );
        void window.electron
            ?.getAppUpdateState?.()
            .then((state) => this.state.set(state))
            .catch(() => this.failed());
    }
    private failed(): void {
        this.state.update((state) => ({
            ...state,
            phase: 'error',
            message:
                'Não foi possível consultar a atualização. Tente novamente.',
        }));
    }
    async check(): Promise<void> {
        try {
            const state = await window.electron?.checkForAppUpdates?.();
            if (state) this.state.set(state);
        } catch {
            this.failed();
        }
    }
    async download(): Promise<void> {
        try {
            const state = await window.electron?.downloadAppUpdate?.();
            if (state) this.state.set(state);
        } catch {
            this.failed();
        }
    }
    async install(): Promise<void> {
        try {
            if (!(await window.electron?.installAppUpdate?.())) this.failed();
        } catch {
            this.failed();
        }
    }
    ngOnDestroy(): void {
        this.unsubscribe?.();
    }
}

import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ArtPlayerComponent } from '../art-player/art-player.component';
import { VjsPlayerComponent } from '../vjs-player/vjs-player.component';

describe('Player audio recovery lifecycle', () => {
    it.each(['Video.js', 'ArtPlayer'])(
        'reuses the audio graph during %s source retries',
        (name) => {
            TestBed.configureTestingModule({
                providers: [
                    {
                        provide: ElementRef,
                        useValue: new ElementRef(document.createElement('div')),
                    },
                ],
            });
            const component: any =
                name === 'Video.js'
                    ? new VjsPlayerComponent()
                    : TestBed.runInInjectionContext(
                          () => new ArtPlayerComponent()
                      );
            const video = document.createElement('video');
            const root = document.createElement('div');
            root.appendChild(video);
            component.player = { video, el: () => root };
            const analyser = {
                frequencyBinCount: 128,
                connect: jest.fn(),
                disconnect: jest.fn(),
                getByteTimeDomainData: jest.fn(),
            };
            const mediaSource = { connect: jest.fn(), disconnect: jest.fn() };
            const context = {
                state: 'suspended',
                destination: {},
                createMediaElementSource: jest.fn(() => mediaSource),
                createAnalyser: jest.fn(() => analyser),
                resume: jest.fn().mockResolvedValue(undefined),
                close: jest.fn().mockResolvedValue(undefined),
            };
            const original = Object.getOwnPropertyDescriptor(
                window,
                'AudioContext'
            );
            Object.defineProperty(window, 'AudioContext', {
                configurable: true,
                value: jest.fn(() => context),
            });
            try {
                const originalUrl =
                    'http://localhost:3000/stream?url=' +
                    encodeURIComponent(
                        'http://example.test/movie/demo/demo/1.mp4'
                    );
                component.currentSourceUrl = component.currentPlaybackUrl =
                    originalUrl;
                component.startSilenceCheck();
                component.currentSourceUrl = component.currentPlaybackUrl =
                    originalUrl + '&transcode=1';
                component.startSilenceCheck();

                expect(context.createMediaElementSource).toHaveBeenCalledTimes(
                    1
                );
                expect(context.createMediaElementSource).toHaveBeenCalledWith(
                    video
                );
                expect(context.resume).toHaveBeenCalled();
                expect(analyser.connect).toHaveBeenCalledWith(
                    context.destination
                );
            } finally {
                component.teardownAudioGraph();
                if (original)
                    Object.defineProperty(window, 'AudioContext', original);
                else delete (window as any).AudioContext;
            }
            expect(mediaSource.disconnect).toHaveBeenCalledTimes(1);
            expect(context.close).toHaveBeenCalledTimes(1);
        }
    );
});

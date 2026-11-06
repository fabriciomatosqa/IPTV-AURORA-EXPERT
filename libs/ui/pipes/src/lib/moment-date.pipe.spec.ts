import { MomentDatePipe } from './moment-date.pipe';

describe('MomentDatePipe', () => {
    const pipe = new MomentDatePipe();

    it('formats a supplied input format without ambiguity', () => {
        expect(
            pipe.transform(
                '06/11/2026 20:15',
                'YYYY-MM-DD HH:mm',
                'DD/MM/YYYY HH:mm'
            )
        ).toBe('2026-11-06 20:15');
    });

    it('detects ISO input and formats it in the local timezone', () => {
        const value = '2026-11-06T23:15:00Z';
        const date = new Date(value);
        const expected = [date.getHours(), date.getMinutes()]
            .map((part) => String(part).padStart(2, '0'))
            .join(':');
        expect(pipe.transform(value, 'HH:mm')).toBe(expected);
    });

    it('reports invalid dates instead of inventing a valid program time', () => {
        expect(pipe.transform('not-a-date', 'YYYY-MM-DD', 'YYYY-MM-DD')).toBe(
            'Invalid date'
        );
    });
});

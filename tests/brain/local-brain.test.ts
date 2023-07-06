import { LocalBrain } from '../../src/brain';
import { describe, test, expect } from 'vitest';

describe('brain/local-brain', () => {
    test('basic storage', async () => {
        const brain = new LocalBrain();

        await brain.set('test', { test: 'object' });

        expect(await brain.has('test')).toBe(true);
        expect(await brain.get('test')).toEqual({ test: 'object' });

        await brain.delete('test');

        expect(await brain.has('test')).toBe(false);
        expect(await brain.get('test')).toBe(null);
    });

    test('basic storage with ttl', async () => {
        const brain = new LocalBrain();

        await brain.set('test', { test: 'object' }, 1);

        await new Promise((resolve) => setTimeout(resolve, 1_100));

        expect(await brain.has('test')).toBe(false);
        expect(await brain.get('test')).toBe(null);
    });
});

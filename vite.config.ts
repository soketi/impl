/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        includeSource: [
            'src/**/*.ts',
        ],
        testTimeout: 5_000,
        maxConcurrency: 1,
        clearMocks: true,
        watch: false,
        coverage: {
            provider: 'c8',
            reporter: ['text', 'json', 'html', 'clover'],
            all: true,
        },
        singleThread: true,
        isolate: true,
        useAtomics: true,
        logHeapUsage: true,
    },
});

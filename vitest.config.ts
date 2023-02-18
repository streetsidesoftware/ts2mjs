import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        reporters: 'verbose',
        coverage: {
            // enabled: true,
            clean: true,
            all: true,
            reporter: ['html', 'text', 'lcov', 'json'],
            exclude: [
                '_snapshots_',
                '.eslint*',
                '.prettier*',
                '**/*.test.*',
                'bin.mjs',
                'dist',
                'fixtures/**',
                'fixtures/**/*.js',
                '**/*.d.mts',
                '**/*.d.ts',
                'vitest*',
            ],
        },
        include: ['src/**/*.test.{ts,mts}'],
        exclude: ['content/**', 'fixtures/**', 'fixtures/**/*.js', 'bin.mjs', '_snapshots_'],
    },
});

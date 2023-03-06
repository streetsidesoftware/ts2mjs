import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        reporters: 'verbose',
        coverage: {
            // enabled: true,
            provider: 'istanbul',
            clean: true,
            all: false,
            reporter: ['html', 'text', 'lcov', 'json'],
            exclude: [
                '_snapshots_',
                '.eslint*',
                '.prettier*',
                '**/*.test.*',
                'bin.mjs',
                'dist',
                '**/fixtures/**',
                '**/fixtures/sample/lib/*.js',
                '**/*.d.mts',
                '**/*.d.ts',
                'vitest*',
            ],
        },
        include: ['src/**/*.test.{ts,mts}'],
        exclude: ['content/**', 'fixtures/**', 'fixtures/**/*.js', 'bin.mjs', '_snapshots_'],
    },
});

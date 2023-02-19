import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = join(__dirname, '..');
const fixtureDir = join(root, 'fixtures');
const tempBase = join(root, 'temp/tests');

export function resolveFixture(...parts: string[]): string {
    return resolve(fixtureDir, ...parts);
}

export function resolverTemp(): (...parts: string[]) => string {
    const tempDir = resolve(tempBase, new Date().toISOString().replace(/[:]/g, '.'), nonce());

    return (...parts: string[]) => {
        return resolve(tempDir, ...parts);
    };
}

export function resolveTempUnique(...parts: string[]): string {
    return resolverTemp()(...parts);
}

function nonce(length = 6): string {
    const digits = '01234567890';
    const parts: string[] = [];

    for (let i = 0; i < length; ++i) {
        parts[i] = digits[Math.floor(Math.random() * 10)];
    }

    return parts.join('');
}

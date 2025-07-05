import * as path from 'path';
import { describe, expect, test } from 'vitest';

import { rebaseFile } from './fileUtils.js';

describe('fileUtils', () => {
    test.each`
        filename         | fromDir                | toDir                   | expected
        ${__filename}    | ${__dirname}           | ${__dirname}            | ${__filename}
        ${'file.txt'}    | ${__dirname}           | ${__dirname}            | ${p(__dirname, 'file.txt')}
        ${'file.txt'}    | ${p(__dirname, 'src')} | ${p(__dirname, 'dest')} | ${p(__dirname, 'dest/file.txt')}
        ${'../file.txt'} | ${p(__dirname, 'src')} | ${p(__dirname, 'dest')} | ${'../file.txt'}
    `('rebaseFile', ({ filename, fromDir, toDir, expected }) => {
        const result = rebaseFile(filename, fromDir, toDir);
        expect(result).toBe(expected);
    });
});

function p(base: string, ...parts: string[]): string {
    return path.join(base, ...parts);
}

import { promises as fs } from 'fs';
import { describe, expect, test } from 'vitest';

import { processFile } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';
import { resolveFixture, resolverTemp } from './test.util.js';

const ff = resolveFixture;

const oc = (obj: unknown) => expect.objectContaining(obj);

describe('processFile', () => {
    test.each`
        file                       | root            | target      | expected
        ${'sample/lib/index.js'}   | ${'sample/lib'} | ${'target'} | ${oc({ filename: ff('sample/lib/index.mjs'), linesChanged: 3 })}
        ${'sample/lib/index.d.ts'} | ${'sample/lib'} | ${'target'} | ${oc({ filename: ff('sample/lib/index.d.mts'), linesChanged: 7 })}
    `('processFile $file', async ({ file, root, target, expected }) => {
        const resolveTemp = resolverTemp();
        file = ff(file);
        root = ff(root);
        target = resolveTemp(target);

        const src = await readSourceFile(file);
        const result = processFile(src, root, target);
        expect(result).toEqual(expected);
        expect(result.content).toMatchSnapshot();
    });

    test.each`
        file                          | root                | expected
        ${ff('sample/lib/image.css')} | ${ff('sample/lib')} | ${Error('Must be a supported file type.')}
        ${ff('sample/src/index.js')}  | ${ff('sample/lib')} | ${Error('Must be under root.')}
    `('processFile skipped', async ({ file, root, expected }) => {
        const content = '';
        const target = ff('../temp/lib');
        expect(() => processFile({ srcFilename: file, content }, root, target)).toThrowError(expected);
    });
});

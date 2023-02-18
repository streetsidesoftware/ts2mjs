import { describe, expect, test } from 'vitest';

import { processSourceFile, __testing__ } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';
import { resolveFixture, resolverTemp } from './test.util.js';

const ff = resolveFixture;

const oc = (obj: unknown) => expect.objectContaining(obj);

describe('processFile', () => {
    test.each`
        file                       | root            | target      | expected
        ${'sample/lib/index.js'}   | ${'sample/lib'} | ${'target'} | ${{ filename: 'target/index.mjs', linesChanged: 2 }}
        ${'sample/lib/index.d.ts'} | ${'sample/lib'} | ${'target'} | ${{ filename: 'target/index.d.mts', linesChanged: 3 }}
    `('processFile $file', async ({ file, root, target, expected }) => {
        const resolveTemp = resolverTemp();
        file = ff(file);
        root = ff(root);
        target = resolveTemp(target);

        const resolvedExpected = oc({
            ...expected,
            filename: resolveTemp(expected.filename),
            oldFilename: file,
        });

        const src = await readSourceFile(file);
        const result = processSourceFile(src, root, target);
        expect(result).toEqual(resolvedExpected);
        expect(result.content).toMatchSnapshot();
    });

    test.each`
        file                          | root                | expected
        ${ff('sample/lib/image.css')} | ${ff('sample/lib')} | ${Error('Must be a supported file type.')}
        ${ff('sample/src/index.js')}  | ${ff('sample/lib')} | ${Error('Must be under root.')}
    `('processFile skipped', async ({ file, root, expected }) => {
        const content = '';
        const target = ff('../temp/lib');
        expect(() => processSourceFile({ srcFilename: file, content }, root, target)).toThrowError(expected);
    });

    test.each`
        file                               | root            | target        | expected
        ${ff('sample/lib/index.js')}       | ${ff('sample')} | ${ff('temp')} | ${ff('temp/lib/index.mjs')}
        ${ff('sample/lib/index.js.map')}   | ${ff('sample')} | ${ff('temp')} | ${ff('temp/lib/index.mjs.map')}
        ${ff('sample/lib/index.d.ts.map')} | ${ff('sample')} | ${ff('temp')} | ${ff('temp/lib/index.d.mts.map')}
        ${ff('sample/lib/style.css')}      | ${ff('sample')} | ${ff('temp')} | ${ff('temp/lib/style.css')}
    `('calcNewFilename', ({ file, root, target, expected }) => {
        expect(__testing__.calcNewFilename(file, root, target)).toEqual(expected);
    });
});

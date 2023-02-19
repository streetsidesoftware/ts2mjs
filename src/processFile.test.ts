import { describe, expect, test } from 'vitest';

import { processSourceFile, __testing__ } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';
import { resolveFixture, resolverTemp } from './test.util.js';

const ff = resolveFixture;

const oc = (obj: unknown) => expect.objectContaining(obj);
const sc = (text: string) => expect.stringContaining(text);

describe('processFile', () => {
    test.each`
        file                                | root                     | target      | expected
        ${'sample/lib/index.js'}            | ${'sample/lib'}          | ${'target'} | ${{ filename: 'target/index.mjs', linesChanged: 2 }}
        ${'sample/lib/index.d.ts'}          | ${'sample/lib'}          | ${'target'} | ${{ filename: 'target/index.d.mts', linesChanged: 3 }}
        ${'sample/lib/database/fetch.d.ts'} | ${'sample/lib/database'} | ${'target'} | ${{ filename: 'target/fetch.d.mts', linesChanged: 1, content: sc("/../fixtures/sample/lib/types.js';") }}
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
        const result = processSourceFile(src, { root, target, allowJsOutsideOfRoot: true });
        expect(result).toEqual(resolvedExpected);
        expect(result.content).toMatchSnapshot();
    });

    test.each`
        file                      | root            | expected
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${Error('Must be a supported file type (.js, .mjs, .d.ts, .d.mts).')}
        ${'sample/src/index.js'}  | ${'sample/lib'} | ${Error('Must be under root.')}
    `('processFile not processed $file', async ({ file, root, expected }) => {
        root = ff(root);
        file = ff(file);
        const content = '';
        const target = ff('../temp/lib');
        expect(() => processSourceFile({ srcFilename: file, content }, { root, target })).toThrowError(expected);
    });

    test.each`
        file                                | root                     | expected
        ${'sample/lib/database/fetch.d.ts'} | ${'sample/lib/database'} | ${Error('Import of a file outside of the root. Import: (../types.js) Source: (fetch.d.ts)')}
    `('processFile error $file', async ({ file, root, expected }) => {
        root = ff(root);
        file = ff(file);
        const source = await readSourceFile(file);
        const target = ff('../temp/lib');
        expect(() => processSourceFile(source, { root, target })).toThrowError(expected);
    });

    test.each`
        file                           | root        | target    | expected
        ${'sample/lib/index.js'}       | ${'sample'} | ${'temp'} | ${'temp/lib/index.mjs'}
        ${'sample/lib/index.js.map'}   | ${'sample'} | ${'temp'} | ${'temp/lib/index.mjs.map'}
        ${'sample/lib/index.d.ts.map'} | ${'sample'} | ${'temp'} | ${'temp/lib/index.d.mts.map'}
        ${'sample/lib/style.css'}      | ${'sample'} | ${'temp'} | ${'temp/lib/style.css'}
    `('calcNewFilename $file', ({ file, root, target, expected }) => {
        expect(__testing__.calcNewFilename(ff(file), ff(root), ff(target))).toEqual(ff(expected));
    });

    test.each`
        importFile       | currentFile                   | root                 | target          | expected
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample'}          | ${'temp'}       | ${'../types.mjs'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample'}          | ${'sample'}     | ${'../types.mjs'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample/lib'}      | ${'sample'}     | ${'../types.mjs'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample/lib/util'} | ${'sample'}     | ${'./lib/types.js'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample/lib/util'} | ${'sample/lib'} | ${'./types.js'}
    `(
        'calcRelativeImportFilename $importFile $currentFile $root $target',
        ({ importFile, currentFile, root, target, expected }) => {
            expect(__testing__.calcRelativeImportFilename(importFile, ff(currentFile), ff(root), ff(target))).toEqual(
                expected
            );
        }
    );
});

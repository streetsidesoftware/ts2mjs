import { describe, expect, test, vi } from 'vitest';
import { UsageError } from './errors.js';

import { processSourceFile, __testing__ } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';
import { resolveFixture, resolverTemp } from './test.util.js';

const ff = resolveFixture;

const oc = (obj: unknown) => expect.objectContaining(obj);
const sc = (text: string) => expect.stringContaining(text);

describe('processFile', () => {
    test.each`
        file                       | root            | target      | ext      | expected
        ${'sample/lib/index.js'}   | ${'sample/lib'} | ${'target'} | ${'mjs'} | ${{ filename: 'target/index.mjs', linesChanged: 2 }}
        ${'sample/lib/index.d.ts'} | ${'sample/lib'} | ${'target'} | ${'mjs'} | ${{ filename: 'target/index.d.mts', linesChanged: 3 }}
        ${'sample/lib/index.js'}   | ${'sample/lib'} | ${'target'} | ${'cjs'} | ${{ filename: 'target/index.cjs', linesChanged: 2 }}
        ${'sample/lib/index.d.ts'} | ${'sample/lib'} | ${'target'} | ${'cjs'} | ${{ filename: 'target/index.d.cts', linesChanged: 3 }}
    `('processFile $file', async ({ file, root, ext, target, expected }) => {
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
        const result = processSourceFile(src, { root, target, warning: vi.fn(), ext });
        expect(result).toEqual(resolvedExpected);
        expect(result?.content).toMatchSnapshot();
    });

    test.each`
        file                        | root        | target      | ext      | expected
        ${'sample/out/app.mjs'}     | ${'sample'} | ${'sample'} | ${'mjs'} | ${undefined}
        ${'sample/lib-cjs/app.cjs'} | ${'sample'} | ${'sample'} | ${'cjs'} | ${undefined}
    `('processFile skip $file', async ({ file, root, target, ext, expected }) => {
        file = ff(file);
        root = ff(root);
        target = ff(target);

        const src = await readSourceFile(file);
        const result = processSourceFile(src, { root, target, ext, warning: vi.fn() });
        expect(result).toEqual(expected);
    });

    test.each`
        file                                | root                     | target      | expected
        ${'sample/lib/database/fetch.d.ts'} | ${'sample/lib/database'} | ${'target'} | ${{ filename: 'target/fetch.d.mts', linesChanged: 1, content: sc("/../fixtures/sample/lib/types.js';") }}
    `('processFile allowJsOutsideOfRoot $file', async ({ file, root, target, expected }) => {
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
        const warning = vi.fn();
        const result = processSourceFile(src, { root, target, ext: 'mjs', allowJsOutsideOfRoot: true, warning });
        expect(result).toEqual(resolvedExpected);
        expect(result?.content).toMatchSnapshot();
        expect(warning).toHaveBeenCalledWith(sc('Import of a file outside of the root'));
    });

    test.each`
        file                      | root            | ext      | expected
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${'mjs'} | ${new UsageError('Must be a supported file type (.js, .mjs, .d.ts, .d.mts).')}
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${'cjs'} | ${new UsageError('Must be a supported file type (.js, .cjs, .d.ts, .d.cts).')}
        ${'sample/src/index.js'}  | ${'sample/lib'} | ${'mjs'} | ${new UsageError('Must be under root.')}
    `('processFile not processed $file', async ({ file, root, ext, expected }) => {
        root = ff(root);
        file = ff(file);
        const content = '';
        const target = ff('../temp/lib');
        expect(() =>
            processSourceFile({ srcFilename: file, content }, { root, target, ext, warning: vi.fn() }),
        ).toThrowError(expected);
    });

    test.each`
        file                                | root                     | expected
        ${'sample/lib/database/fetch.d.ts'} | ${'sample/lib/database'} | ${new UsageError('Import of a file outside of the root. Import: (../types.js) Source: (fetch.d.ts)')}
    `('processFile error $file', async ({ file, root, expected }) => {
        root = ff(root);
        file = ff(file);
        const source = await readSourceFile(file);
        const target = ff('../temp/lib');
        expect(() => processSourceFile(source, { root, target, ext: 'mjs', warning: vi.fn() })).toThrowError(expected);
    });

    test.each`
        file                           | root        | target    | ext      | expected
        ${'sample/lib/index.js'}       | ${'sample'} | ${'temp'} | ${'mjs'} | ${'temp/lib/index.mjs'}
        ${'sample/lib/index.js.map'}   | ${'sample'} | ${'temp'} | ${'mjs'} | ${'temp/lib/index.mjs.map'}
        ${'sample/lib/index.d.ts.map'} | ${'sample'} | ${'temp'} | ${'mjs'} | ${'temp/lib/index.d.mts.map'}
        ${'sample/lib/style.css'}      | ${'sample'} | ${'temp'} | ${'mjs'} | ${'temp/lib/style.css'}
        ${'sample/lib/index.js'}       | ${'sample'} | ${'temp'} | ${'cjs'} | ${'temp/lib/index.cjs'}
        ${'sample/lib/index.js.map'}   | ${'sample'} | ${'temp'} | ${'cjs'} | ${'temp/lib/index.cjs.map'}
        ${'sample/lib/index.d.ts.map'} | ${'sample'} | ${'temp'} | ${'cjs'} | ${'temp/lib/index.d.cts.map'}
        ${'sample/lib/style.css'}      | ${'sample'} | ${'temp'} | ${'cjs'} | ${'temp/lib/style.css'}
    `('calcNewFilename $file', ({ file, root, target, ext, expected }) => {
        expect(__testing__.calcNewFilename(ff(file), ff(root), ff(target), ext)).toEqual(ff(expected));
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
                expected,
            );
        },
    );
});

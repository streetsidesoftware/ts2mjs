import { describe, expect, test, vi } from 'vitest';
import { UsageError } from './errors.js';

import { processSourceFile, __testing__, isSupportedFileType } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';
import { resolveFixture, resolverTemp } from './test.util.js';
import { AssertionError } from 'assert';

const ff = resolveFixture;

const oc = (obj: unknown) => expect.objectContaining(obj);
const sc = (text: string) => expect.stringContaining(text);

describe('processFile', () => {
    test.each`
        file                           | root                | target      | ext       | expected
        ${'sample/lib/index.js'}       | ${'sample/lib'}     | ${'target'} | ${'.mjs'} | ${{ filename: 'target/index.mjs', linesChanged: 2 }}
        ${'sample/lib-cjs/index.js'}   | ${'sample/lib-cjs'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/index.cjs', linesChanged: 2 }}
        ${'sample/lib-cjs/index.d.ts'} | ${'sample/lib-cjs'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/index.d.ts', linesChanged: 3 }}
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
        file                        | root        | target      | ext       | expected
        ${'sample/out/app.mjs'}     | ${'sample'} | ${'sample'} | ${'.mjs'} | ${undefined}
        ${'sample/lib-cjs/app.cjs'} | ${'sample'} | ${'sample'} | ${'.cjs'} | ${undefined}
    `('processFile skip $file', async ({ file, root, target, ext, expected }) => {
        file = ff(file);
        root = ff(root);
        target = ff(target);

        const src = await readSourceFile(file);
        const result = processSourceFile(src, { root, target, ext, warning: vi.fn() });
        expect(result).toEqual(expected);
    });

    test.each`
        file                                    | root                         | target      | ext       | expected
        ${'sample/lib-cjs/database/fetch.d.ts'} | ${'sample/lib-cjs/database'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/fetch.d.ts', linesChanged: 1, content: sc("/../fixtures/sample/lib-cjs/types.js';") }}
        ${'sample/lib-cjs/database/fetch.js'}   | ${'sample/lib-cjs/database'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/fetch.cjs', linesChanged: 1, content: sc('../fixtures/sample/lib-cjs/constants.js");') }}
    `('processFile allowJsOutsideOfRoot $file', async ({ file, root, target, ext, expected }) => {
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
        const result = processSourceFile(src, { root, target, ext, allowJsOutsideOfRoot: true, warning });
        expect(result).toEqual(resolvedExpected);
        expect(result?.content).toMatchSnapshot();
        expect(warning).toHaveBeenCalledWith(sc('Import of a file outside of the root'));
    });

    test.each`
        file                      | root            | ext       | expected
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${'.mjs'} | ${makeAssertionError({ message: 'Must be a supported file type (.js, .mjs, .d.mts).' })}
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${'.cjs'} | ${makeAssertionError('Must be a supported file type (.js, .cjs, .d.ts, .d.cts).')}
        ${'sample/src/index.js'}  | ${'sample/lib'} | ${'.mjs'} | ${makeAssertionError('Must be under root.')}
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
        file                                    | root                         | ext       | expected
        ${'sample/lib-cjs/database/fetch.d.ts'} | ${'sample/lib-cjs/database'} | ${'.cjs'} | ${new UsageError('Import of a file outside of the root. Import: (../types.js) Source: (fetch.d.ts)')}
        ${'sample/lib-cjs/database/fetch.js'}   | ${'sample/lib-cjs/database'} | ${'.cjs'} | ${new UsageError('Import of a file outside of the root. Require: (../constants.js) Source: (fetch.js)')}
    `('processFile error $file', async ({ file, root, ext, expected }) => {
        root = ff(root);
        file = ff(file);
        const source = await readSourceFile(file);
        const target = ff('../temp/lib');
        expect(() => processSourceFile(source, { root, target, ext, warning: vi.fn() })).toThrowError(expected);
    });

    test.each`
        file                           | root        | target    | ext       | expected
        ${'sample/lib/index.js'}       | ${'sample'} | ${'temp'} | ${'.mjs'} | ${'temp/lib/index.mjs'}
        ${'sample/lib/index.js.map'}   | ${'sample'} | ${'temp'} | ${'.mjs'} | ${'temp/lib/index.mjs.map'}
        ${'sample/lib/style.css'}      | ${'sample'} | ${'temp'} | ${'.mjs'} | ${'temp/lib/style.css'}
        ${'sample/lib/index.js'}       | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/index.cjs'}
        ${'sample/lib/index.js.map'}   | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/index.cjs.map'}
        ${'sample/lib/index.d.ts.map'} | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/index.d.ts.map'}
        ${'sample/lib/style.css'}      | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/style.css'}
    `('calcNewFilename $file', ({ file, root, target, ext, expected }) => {
        expect(__testing__.calcNewFilename(ff(file), ff(root), ff(target), ext)).toEqual(ff(expected));
    });

    test.each`
        importFile       | currentFile                   | root                 | target          | ext       | expected
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample'}          | ${'temp'}       | ${'.mjs'} | ${'../types.mjs'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample'}          | ${'sample'}     | ${'.mjs'} | ${'../types.mjs'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample/lib'}      | ${'sample'}     | ${'.mjs'} | ${'../types.mjs'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample/lib/util'} | ${'sample'}     | ${'.mjs'} | ${'./lib/types.js'}
        ${'../types.js'} | ${'sample/lib/util/index.js'} | ${'sample/lib/util'} | ${'sample/lib'} | ${'.mjs'} | ${'./types.js'}
    `(
        'calcRelativeImportFilename $importFile $currentFile $root $target',
        ({ importFile, currentFile, root, target, ext, expected }) => {
            expect(
                __testing__.calcRelativeImportFilename(importFile, ff(currentFile), ff(root), ff(target), ext),
            ).toEqual(expected);
        },
    );

    test.each`
        filename       | ext       | expected
        ${'code.ts'}   | ${'.mjs'} | ${false}
        ${'code.d.ts'} | ${'.mjs'} | ${false}
        ${'code.js'}   | ${'.mjs'} | ${true}
        ${'code.mjs'}  | ${'.mjs'} | ${true}
        ${'code.cjs'}  | ${'.mjs'} | ${false}
        ${'code.ts'}   | ${'.cjs'} | ${false}
        ${'code.d.ts'} | ${'.cjs'} | ${true}
        ${'code.js'}   | ${'.cjs'} | ${true}
        ${'code.mjs'}  | ${'.cjs'} | ${false}
        ${'code.cjs'}  | ${'.cjs'} | ${true}
    `('isSupportedFileType $filename `$ext`', ({ filename, ext, expected }) => {
        expect(isSupportedFileType(filename, ext)).toBe(expected);
    });
});

interface AssertErrorOptions {
    /** If provided, the error message is set to this value. */
    message?: string | undefined;
    /** The `actual` property on the error instance. */
    actual?: unknown | undefined;
    /** The `expected` property on the error instance. */
    expected?: unknown | undefined;
    /** The `operator` property on the error instance. */
    operator?: string | undefined;
}

function makeAssertionError(err: string | AssertErrorOptions) {
    const {
        message,
        actual = false,
        expected = true,
        operator = '==',
    } = typeof err === 'string' ? { message: err } : err;
    return new AssertionError({ message, actual, expected, operator });
}

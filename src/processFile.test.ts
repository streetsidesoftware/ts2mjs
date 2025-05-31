import { describe, expect, test, vi } from 'vitest';
import { UsageError } from './errors.js';

import { processSourceFile, __testing__, isSupportedFileType } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';
import { resolveFixture, resolverTemp } from './test.util.js';
import { AssertionError } from 'assert';

const ff = resolveFixture;

const oc = (obj: unknown) => expect.objectContaining(obj);
const sc = (text: string) => expect.stringContaining(text);

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

describe('processFile', () => {
    test.each`
        file                           | root                | target      | ext       | expected
        ${'sample/lib/index.js'}       | ${'sample/lib'}     | ${'target'} | ${'.mjs'} | ${{ filename: 'target/index.mjs', linesChanged: 2 }}
        ${'sample/lib/index.d.ts'}     | ${'sample/lib'}     | ${'target'} | ${'.mjs'} | ${{ filename: 'target/index.d.mts', linesChanged: 3 }}
        ${'sample/lib-cjs/index.js'}   | ${'sample/lib-cjs'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/index.cjs', linesChanged: 2 }}
        ${'sample/lib-cjs/index.d.ts'} | ${'sample/lib-cjs'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/index.d.cts', linesChanged: 3 }}
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
        ${'sample/lib/database/fetch.d.ts'}     | ${'sample/lib/database'}     | ${'target'} | ${'.mjs'} | ${{ filename: 'target/fetch.d.mts', linesChanged: 1, content: sc("/../fixtures/sample/lib/types.js';") }}
        ${'sample/lib-cjs/database/fetch.d.ts'} | ${'sample/lib-cjs/database'} | ${'target'} | ${'.cjs'} | ${{ filename: 'target/fetch.d.cts', linesChanged: 1, content: sc("/../fixtures/sample/lib-cjs/types.js';") }}
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
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${'.mjs'} | ${makeAssertionError({ message: 'Must be a supported file type (.js, .mjs, .ts, .mts, .d.ts, .d.mts).' })}
        ${'sample/lib/image.css'} | ${'sample/lib'} | ${'.cjs'} | ${makeAssertionError('Must be a supported file type (.js, .cjs, .ts, .cts, .d.ts, .d.cts).')}
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
        ${'sample/lib/index.d.ts.map'} | ${'sample'} | ${'temp'} | ${'.mjs'} | ${'temp/lib/index.d.mts.map'}
        ${'sample/lib/style.css'}      | ${'sample'} | ${'temp'} | ${'.mjs'} | ${'temp/lib/style.css'}
        ${'sample/lib/index.js'}       | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/index.cjs'}
        ${'sample/lib/index.js.map'}   | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/index.cjs.map'}
        ${'sample/lib/index.d.ts.map'} | ${'sample'} | ${'temp'} | ${'.cjs'} | ${'temp/lib/index.d.cts.map'}
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
        filename       | ext       | skipTs    | expected
        ${'code.ts'}   | ${'.mjs'} | ${false}  | ${true}
        ${'code.ts'}   | ${'.mjs'} | ${true}   | ${false}
        ${'code.d.ts'} | ${'.mjs'} | ${false}  | ${true}
        ${'code.d.ts'} | ${'.mjs'} | ${true}   | ${false}
        ${'code.js'}   | ${'.mjs'} | ${false}  | ${true}
        ${'code.js'}   | ${'.mjs'} | ${true}   | ${true}
        ${'code.mjs'}  | ${'.mjs'} | ${false}  | ${true}
        ${'code.mjs'}  | ${'.mjs'} | ${true}   | ${true}
        ${'code.cjs'}  | ${'.mjs'} | ${false}  | ${false}
        ${'code.cjs'}  | ${'.mjs'} | ${true}   | ${false}
        ${'code.ts'}   | ${'.cjs'} | ${false}  | ${true}
        ${'code.ts'}   | ${'.cjs'} | ${true}   | ${false}
        ${'code.d.ts'} | ${'.cjs'} | ${false}  | ${true}
        ${'code.d.ts'} | ${'.cjs'} | ${true}   | ${false}
        ${'code.js'}   | ${'.cjs'} | ${false}  | ${true}
        ${'code.js'}   | ${'.cjs'} | ${true}   | ${true}
        ${'code.mjs'}  | ${'.cjs'} | ${false}  | ${false}
        ${'code.mjs'}  | ${'.cjs'} | ${true}   | ${false}
        ${'code.cjs'}  | ${'.cjs'} | ${false}  | ${true}
        ${'code.cjs'}  | ${'.cjs'} | ${true}   | ${true}
    `('isSupportedFileType $filename `$ext` skipTs=$skipTs', ({ filename, ext, skipTs, expected }) => {
        expect(isSupportedFileType(filename, ext, skipTs)).toBe(expected);
    });

    test('handles duplicate imports correctly', async () => {
        // Test case based on real compiled TypeScript output with duplicate imports
        const content = `
"use strict";
const optional_require_ts_1 = require("./optional-require.js");
Object.defineProperty(exports, "makeOptionalRequire", { enumerable: true, get: function () { return optional_require_ts_1.makeOptionalRequire; } });
const optionalRequire = (0, optional_require_ts_1.makeOptionalRequire)(appPath);
__exportStar(require("./optional-require.js"), exports);
`.trim();

        const src = { srcFilename: ff('sample/lib/test.js'), content };
        const result = processSourceFile(src, {
            root: ff('sample/lib'),
            target: ff('temp'),
            ext: '.cjs',
            warning: vi.fn()
        });

        expect(result).toBeTruthy();

        // Check that ALL occurrences are replaced, not just the first one
        const jsOccurrences = (result!.content.match(/optional-require\.js/g) || []).length;
        const cjsOccurrences = (result!.content.match(/optional-require\.cjs/g) || []).length;

        expect(jsOccurrences).toBe(0); // No .js should remain
        expect(cjsOccurrences).toBe(2); // Both should be converted to .cjs

        // Verify the actual content contains the expected conversions
        expect(result!.content).toContain('require("./optional-require.cjs")');
        expect(result!.content).not.toContain('require("./optional-require.js")');
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
});

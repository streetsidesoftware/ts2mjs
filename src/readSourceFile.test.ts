import { pathToFileURL } from 'url';
import { describe, expect, test } from 'vitest';

import { getSourceMapRef, readSourceFile, readSourceMap, SOURCE_MAP_URL_MARKER } from './readSourceFile.js';
import { resolveFixture as ff } from './test.util.js';

const oc = (obj: unknown) => expect.objectContaining(obj);

describe('ReadSourceFile', () => {
    test.each`
        file
        ${'sample/lib/index.js.map'}
        ${'sample/lib/notfound.js.map'}
    `('readSourceMap $file', async ({ file }) => {
        file = ff(file);
        const url = pathToFileURL(file);
        expect((await readSourceMap(url))?.map).toMatchSnapshot();
    });

    test.each`
        file
        ${'sample/lib/index.js'}
    `('readSourceFile $file', async ({ file }) => {
        file = ff(file);
        expect((await readSourceFile(file))?.map?.map).toMatchSnapshot();
    });

    test.each`
        file                        | expected
        ${'sample/lib/notfound.js'} | ${oc({ code: 'ENOENT', message: expect.stringContaining('no such file') })}
    `('readSourceFile error $file', async ({ file, expected }) => {
        file = ff(file);
        await expect(readSourceFile(file)).rejects.toEqual(expected);
    });

    test.each`
        file                        | content                                                        | expected
        ${'sample/lib/index.js'}    | ${`export const x = 5;\n${SOURCE_MAP_URL_MARKER}index.js.map`} | ${oc({ index: 20 })}
        ${'sample/lib/notfound.js'} | ${`\n${SOURCE_MAP_URL_MARKER}notfound.js.map`}                 | ${oc({ index: 1 })}
        ${'sample/lib/url.js'}      | ${`\n${SOURCE_MAP_URL_MARKER}https::url.js.map`}               | ${undefined}
    `('getSourceMapRef $file', async ({ file, content, expected }) => {
        file = ff(file);
        expect(await getSourceMapRef(file, content)).toEqual(expected);
    });
});

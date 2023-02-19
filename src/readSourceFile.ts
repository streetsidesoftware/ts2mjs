import { readFile } from './fileUtils.js';
import type { SourceFile, SourceMap } from './SourceFile.js';
import { fileURLToPath, pathToFileURL } from 'url';

export const SOURCE_MAP_URL_MARKER = '//' + '# ' + 'sourceMappingURL' + '=';

export interface SourceMapRef {
    index: number;
    url: URL;
}

export async function readSourceFile(filename: string): Promise<SourceFile> {
    const content = await readFile(filename);
    const srcMapRef = getSourceMapRef(filename, content);
    const sourceMap = srcMapRef && (await readSourceMap(srcMapRef.url));

    const srcContent = (srcMapRef && content.slice(0, srcMapRef.index)) || content;

    return {
        srcFilename: filename,
        content: srcContent,
        map: sourceMap,
    };
}

export function getSourceMapRef(filename: string, content: string): SourceMapRef | undefined {
    const srcMapIdx = content.lastIndexOf(SOURCE_MAP_URL_MARKER);
    if (srcMapIdx < 0) return undefined;
    const srcMapUrl = content.slice(srcMapIdx + SOURCE_MAP_URL_MARKER.length).trim();

    try {
        const url = new URL(srcMapUrl, pathToFileURL(filename));
        return { index: srcMapIdx, url };
    } catch (e) {
        return undefined;
    }
}

export async function readSourceMap(url: URL): Promise<SourceMap | undefined> {
    try {
        return { map: await readFile(fileURLToPath(url)), url };
    } catch (e) {
        // do not break if source map file is missing.
        return undefined;
    }
}

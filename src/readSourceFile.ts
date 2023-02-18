import { readFile } from './fileUtils';
import { SourceFile } from './SourceFile';
import { fileURLToPath, pathToFileURL } from 'url';

export const SOURCE_MAP_URL_MARKER = '//' + '# ' + 'sourceMappingURL' + '=';

export async function readSourceFile(filename: string): Promise<SourceFile> {
    const content = await readFile(filename);
    const srcMapRef = getSourceMapRef(filename, content);
    const mappings = srcMapRef && (await readFile(fileURLToPath(srcMapRef.url)));

    const srcContent = (srcMapRef && content.slice(0, srcMapRef.index)) || content;

    return {
        srcFilename: filename,
        content: srcContent,
        mappings,
    };
}

export interface SourceMapRef {
    index: number;
    url: URL;
}

export function getSourceMapRef(filename: string, content: string): SourceMapRef | undefined {
    const srcMapIdx = content.lastIndexOf(SOURCE_MAP_URL_MARKER);
    if (srcMapIdx < 0) return undefined;
    const srcMapUrl = content.slice(srcMapIdx + SOURCE_MAP_URL_MARKER.length);

    try {
        const url = new URL(srcMapUrl, pathToFileURL(filename));
        return { index: srcMapIdx, url };
    } catch (e) {
        return undefined;
    }
}

import { dirname, join as pathJoin, basename } from 'path';
// import MagicString from 'magic-string';
// import mergeMap from 'merge-source-map';

import { doesContain, isRelativePath, rebaseFile } from './fileUtils.js';
import assert from 'assert';
import { SourceFile, SourceMap } from './SourceFile';
import { readSourceFile, SOURCE_MAP_URL_MARKER } from './readSourceFile.js';
import { fileURLToPath, pathToFileURL } from 'url';

const isSupportedFile = /\.(m?js|d\.m?ts)$/;

const regExpImportExport = /(import|export).*? from ('|")(?<file>\..*?)\2;/g;

export interface ProcessFileResult {
    filename: string;
    oldFilename: string;
    content: string;
    linesChanged?: number;
}

interface AdjustedSourceMap extends SourceMap {
    oldUrl: URL;
}

export interface ProcessSourceFileResult extends ProcessFileResult {
    mappings: AdjustedSourceMap | undefined;
}

export function processSourceFile(src: SourceFile, srcRoot: string, targetRoot: string): ProcessSourceFileResult {
    const { srcFilename, content, mappings } = src;

    assert(doesContain(srcRoot, srcFilename), 'Must be under root.');
    assert(isSupportedFile.test(srcFilename), 'Must be a supported file type.');

    const exp = new RegExp(regExpImportExport);

    const currentDir = dirname(srcFilename);

    const segments: string[] = [];
    let linesChanged = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = exp.exec(content))) {
        const { index } = match;
        if (index > lastIndex) {
            segments.push(content.slice(lastIndex, index));
        }
        lastIndex = exp.lastIndex;

        const line = match[0];
        const reference = match.groups?.['file'];

        if (reference && isRelativePath(reference) && doesContain(srcRoot, pathJoin(currentDir, reference))) {
            const newLine = line.replace(/\.js';/, ".mjs';");
            segments.push(newLine);
            linesChanged += linesChanged + (newLine === line ? 0 : 1);
            continue;
        }

        segments.push(line);
    }

    const filename = calcNewFilename(srcFilename, srcRoot, targetRoot);

    const sourceMap = remapSourceMap(mappings, filename);

    if (!linesChanged)
        return {
            filename,
            oldFilename: srcFilename,
            content: addSourceMapToContent(content, sourceMap),
            mappings: sourceMap,
        };

    if (lastIndex < content.length) {
        segments.push(content.slice(lastIndex));
    }

    return {
        filename,
        oldFilename: srcFilename,
        content: addSourceMapToContent(segments.join(''), sourceMap),
        linesChanged,
        mappings: sourceMap,
    };
}

export function isSupportedFileType(filename: string): boolean {
    return isSupportedFile.test(filename);
}

export async function processFile(filename: string, root: string, target: string): Promise<ProcessFileResult[]> {
    const src = await readSourceFile(filename);
    const r = processSourceFile(src, root, target);
    if (!r.mappings) return [r];

    return [r, processSourceMap(r.mappings)];
}

function calcNewFilename(srcFilename: string, root: string, target: string): string {
    const newName = srcFilename.replace(/\.js(\.map)?$/, '.mjs$1').replace(/\.ts(.map)?$/, '.mts$1');
    return rebaseFile(newName, root, target);
}

export const __testing__ = {
    calcNewFilename,
};

function processSourceMap(sourceMap: AdjustedSourceMap): ProcessFileResult {
    const pr: ProcessFileResult = {
        filename: fileURLToPath(sourceMap.url),
        oldFilename: fileURLToPath(sourceMap.oldUrl),
        content: sourceMap.mappings,
        linesChanged: 1,
    };

    return pr;
}

function remapSourceMap(sourceMap: SourceMap | undefined, toSourceFilename: string): AdjustedSourceMap | undefined {
    if (!sourceMap) return undefined;

    const url = pathToFileURL(toSourceFilename + '.map');
    return { url, oldUrl: sourceMap.url, mappings: sourceMap.mappings };
}

function addSourceMapToContent(content: string, sourceMap: AdjustedSourceMap | undefined): string {
    if (!sourceMap) return content;

    const nl = content.endsWith('\n') ? '' : '\n';
    return content + nl + SOURCE_MAP_URL_MARKER + basename(fileURLToPath(sourceMap.url));
}

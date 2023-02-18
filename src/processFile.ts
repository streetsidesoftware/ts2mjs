import { basename, dirname, join as pathJoin, normalize, relative, sep as pathSep } from 'path';

import assert from 'assert';
import { fileURLToPath, pathToFileURL } from 'url';
import { doesContain, isRelativePath, rebaseFile } from './fileUtils.js';
import { readSourceFile, SOURCE_MAP_URL_MARKER } from './readSourceFile.js';
import { SourceFile, SourceMap } from './SourceFile.js';
import { createMagicString, SourceMap as MsSourceMap, MagicString } from '../lib/magicString.mjs';

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
    const { srcFilename, content, map: mappings } = src;

    assert(doesContain(srcRoot, srcFilename), 'Must be under root.');
    assert(isSupportedFile.test(srcFilename), 'Must be a supported file type.');

    const exp = new RegExp(regExpImportExport);

    const magicString = createMagicString(content, { filename: src.srcFilename });

    let linesChanged = 0;
    let match: RegExpExecArray | null;
    while ((match = exp.exec(content))) {
        const { index } = match;

        const line = match[0];
        const reference = match.groups?.['file'];

        if (reference && isRelativePath(reference)) {
            const start = index + line.lastIndexOf(reference);
            const end = start + reference.length;
            const newRef = rebaseImport(reference, srcFilename, srcRoot, targetRoot);
            magicString.update(start, end, newRef);
            linesChanged += 1;
            continue;
        }
    }

    const filename = calcNewFilename(srcFilename, srcRoot, targetRoot);

    const sourceMap = remapSourceMap(mappings, magicString, srcFilename, filename);

    if (!linesChanged)
        return {
            filename,
            oldFilename: srcFilename,
            content: addSourceMapToContent(content, sourceMap),
            mappings: sourceMap,
        };

    return {
        filename,
        oldFilename: srcFilename,
        content: addSourceMapToContent(magicString.toString(), sourceMap),
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
        content: sourceMap.map,
        linesChanged: 1,
    };

    return pr;
}

function remapSourceMap(
    sourceMap: SourceMap | undefined,
    magicString: MagicString,
    fromSourceFilename: string,
    toSourceFilename: string
): AdjustedSourceMap | undefined {
    if (!sourceMap) return undefined;

    const url = pathToFileURL(toSourceFilename + '.map');

    const oldMap = new MsSourceMap(JSON.parse(sourceMap.map));
    const map = magicString.generateMap({ file: toSourceFilename, source: fromSourceFilename });

    console.error('%o', [oldMap, map]);

    return { url, oldUrl: sourceMap.url, map: map.toString() };
}

function addSourceMapToContent(content: string, sourceMap: AdjustedSourceMap | undefined): string {
    if (!sourceMap) return content;

    const nl = content.endsWith('\n') ? '' : '\n';
    return content + nl + SOURCE_MAP_URL_MARKER + basename(fileURLToPath(sourceMap.url));
}

function rebaseRelFileReference(importFile: string, currentFile: string, root: string, target: string): string {
    const currentDir = dirname(currentFile);
    const targetDir = dirname(rebaseFile(currentFile, root, target));

    const importFileAbs = pathJoin(currentDir, importFile);

    const relImport = doesContain(root, importFileAbs)
        ? relative(currentDir, importFileAbs)
        : relative(targetDir, importFileAbs);
    const newImportFile = normalizeImport(relImport);
    return newImportFile;
}

function rebaseImport(importFile: string, currentFile: string, root: string, target: string): string {
    const newImportFile = rebaseRelFileReference(importFile, currentFile, root, target).replace(/\.js$/, '.mjs');
    return newImportFile;
}

function normalizeImport(relativeImport: string): string {
    relativeImport = normalize(relativeImport);
    const ref = pathSep === '\\' ? relativeImport.replace(/[\\]/g, '/') : relativeImport;
    const relRef = ('./' + ref).replace('./../', '../');
    return relRef;
}

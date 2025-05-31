import { basename, dirname, join as pathJoin, normalize, relative, sep as pathSep } from 'path';

import assert from 'assert';
import { fileURLToPath, pathToFileURL } from 'url';
import { createMagicString, MagicString } from '../lib/magicString.mjs';
import { doesContain, isRelativePath, rebaseFile } from './fileUtils.js';
import { readSourceFile, SOURCE_MAP_URL_MARKER } from './readSourceFile.js';
import type { SourceFile, SourceMap } from './SourceFile.js';
import { UsageError } from './errors.js';

const isSupportedFileMJS = /\.(m?js|m?ts|d\.m?ts)$/;
const isSupportedFileCJS = /\.(c?js|c?ts|d\.c?ts)$/;

const regExpImportExport = /(import|export).*? from ('|")(?<file>\..*?)\2;/g;
const regExpRequire = /require\(('|")(?<file>\..*?)\1\)/g;

type ExtensionType = '.cjs' | '.mjs';

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

export function processSourceFile(src: SourceFile, options: ProcessFileOptions): ProcessSourceFileResult | undefined {
    const { srcFilename, content, map: mappings } = src;
    const { root: srcRoot, target: targetRoot, ext } = options;

    assert(doesContain(srcRoot, srcFilename), 'Must be under root.');
    if (options.ext === '.cjs') {
        assert(isSupportedFileCJS.test(srcFilename), 'Must be a supported file type (.js, .cjs, .ts, .cts, .d.ts, .d.cts).');
    } else {
        assert(isSupportedFileMJS.test(srcFilename), 'Must be a supported file type (.js, .mjs, .ts, .mts, .d.ts, .d.mts).');
    }

    const filename = calcNewFilename(srcFilename, srcRoot, targetRoot, ext);
    if (pathJoin(targetRoot, filename) === pathJoin(srcRoot, srcFilename)) {
        // Do not process files in place.
        return undefined;
    }

    const magicString = createMagicString(content, { filename: src.srcFilename });

    let linesChanged = adjustImportExportStatements(src, options, magicString);
    linesChanged += adjustRequireStatements(src, options, magicString);

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

function adjustImportExportStatements(src: SourceFile, options: ProcessFileOptions, magicString: MagicString) {
    const { srcFilename } = src;
    const { root: srcRoot, target: targetRoot, allowJsOutsideOfRoot, ext } = options;

    let linesChanged = 0;
    const content = magicString.toString();

    // Use replace with a callback to handle all matches at once
    const processedContent = content.replace(new RegExp(regExpImportExport, 'g'), (match, ...args) => {
        // Extract groups from the match - the groups are at the end of args array
        const groups = args[args.length - 1];
        const reference = groups?.['file'];

        if (reference && isRelativePath(reference)) {
            if (!doesContain(srcRoot, pathJoin(dirname(srcFilename), reference))) {
                const message = `Import of a file outside of the root. Import: (${reference}) Source: (${relative(
                    srcRoot,
                    srcFilename,
                )})`;
                if (!allowJsOutsideOfRoot) {
                    throw new UsageError(message);
                } else {
                    options.warning(message);
                }
            }
            const newRef = calcRelativeImportFilename(reference, srcFilename, srcRoot, targetRoot, ext);
            linesChanged += 1;
            return match.replace(reference, newRef);
        }
        return match;
    });

    // Apply all changes at once
    if (linesChanged > 0) {
        magicString.update(0, content.length, processedContent);
    }

    return linesChanged;
}

function adjustRequireStatements(src: SourceFile, options: ProcessFileOptions, magicString: MagicString) {
    const { srcFilename } = src;
    const { root: srcRoot, target: targetRoot, allowJsOutsideOfRoot, ext } = options;

    let linesChanged = 0;
    const content = magicString.toString();

    // Use replace with a callback to handle all matches at once
    const processedContent = content.replace(new RegExp(regExpRequire, 'g'), (match, ...args) => {
        // Extract groups from the match - the groups are at the end of args array
        const groups = args[args.length - 1];
        const reference = groups?.['file'];

        if (reference && isRelativePath(reference)) {
            if (!doesContain(srcRoot, pathJoin(dirname(srcFilename), reference))) {
                const message = `Import of a file outside of the root. Require: (${reference}) Source: (${relative(
                    srcRoot,
                    srcFilename,
                )})`;
                if (!allowJsOutsideOfRoot) {
                    throw new UsageError(message);
                } else {
                    options.warning(message);
                }
            }
            const newRef = calcRelativeImportFilename(reference, srcFilename, srcRoot, targetRoot, ext);
            linesChanged += 1;
            return match.replace(reference, newRef);
        }
        return match;
    });

    // Apply all changes at once
    if (linesChanged > 0) {
        magicString.update(0, content.length, processedContent);
    }

    return linesChanged;
}

export function isSupportedFileType(filename: string, ext: ExtensionType, skipTs = false): boolean {
    const baseSupported = (ext === '.mjs' ? isSupportedFileMJS : isSupportedFileCJS).test(filename);

    // If skipTs is enabled, exclude ALL .ts files (including .d.ts files)
    if (skipTs && /\.ts$/.test(filename)) {
        return false;
    }

    return baseSupported;
}

export interface ProcessFileOptions {
    root: string;
    target: string;
    ext: ExtensionType;
    allowJsOutsideOfRoot?: boolean;
    warning: (msg: string) => void;
    skipTs?: boolean;
}

export async function processFile(filename: string, options: ProcessFileOptions): Promise<ProcessFileResult[]> {
    const src = await readSourceFile(filename);
    const r = processSourceFile(src, options);
    if (!r) return [];
    if (!r.mappings) return [r];

    return [r, processSourceMap(r.mappings)];
}

function calcNewFilename(srcFilename: string, root: string, target: string, ext: ExtensionType): string {
    const newName =
        ext === '.mjs'
            ? srcFilename.replace(/\.js(\.map)?$/, '.mjs$1').replace(/\.ts(.map)?$/, '.mts$1')
            : srcFilename.replace(/\.js(\.map)?$/, '.cjs$1').replace(/\.d\.ts(.map)?$/, '.d.cts$1').replace(/\.ts(.map)?$/, '.cts$1');
    return rebaseFile(newName, root, target);
}

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
    toSourceFilename: string,
): AdjustedSourceMap | undefined {
    if (!sourceMap) return undefined;

    const url = pathToFileURL(toSourceFilename + '.map');
    const map = magicString.generateMap({ file: toSourceFilename, source: fromSourceFilename });
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

function calcRelativeImportFilename(
    importFile: string,
    currentFile: string,
    root: string,
    target: string,
    ext: ExtensionType,
): string {
    const newImportFile = rebaseRelFileReference(importFile, currentFile, root, target);
    if (doesContain(root, pathJoin(dirname(currentFile), importFile))) {
        return newImportFile.replace(/\.js$/, ext);
    }
    return newImportFile;
}

function normalizeImport(relativeImport: string): string {
    relativeImport = normalize(relativeImport);
    const ref = pathSep === '\\' ? relativeImport.replace(/[\\]/g, '/') : relativeImport;
    const relRef = ('./' + ref).replace('./../', '../');
    return relRef;
}

export const __testing__ = {
    calcNewFilename,
    calcRelativeImportFilename,
};

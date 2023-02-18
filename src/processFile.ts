import { dirname, join as pathJoin } from 'path';
// import MagicString from 'magic-string';
// import mergeMap from 'merge-source-map';

import { doesContain, isRelativePath } from './fileUtils.js';
import assert from 'assert';
import { SourceFile } from './SourceFile';

const isSupportedFile = /\.(m?js|d\.m?ts)$/;

const regExpImportExport = /(import|export).*? from ('|")(?<file>\..*?)\2;/g;

export interface ProcessResult {
    filename: string;
    content: string;
    linesChanged?: number;
    mappings?: string;
}

export function processFile(src: SourceFile, srcRoot: string, _targetRoot: string): ProcessResult {
    const { srcFilename, content } = src;

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

    const filename = srcFilename.replace(/\.js$/, '.mjs').replace(/\.ts$/, '.mts');

    if (!linesChanged) return { filename, content };

    if (lastIndex < content.length) {
        segments.push(content.slice(lastIndex));
    }

    return { filename, content: segments.join(''), linesChanged };
}

export function isSupportedFileType(filename: string): boolean {
    return isSupportedFile.test(filename);
}

import chalk from 'chalk';
import { promises as fs } from 'fs';
import * as path from 'path';

import { copyFile as cpFile, doesContain, mkdir, rebaseFile, writeFile as writeFileP } from './fileUtils.js';
import { isSupportedFileType, processFile } from './processFile.js';

export interface Options {
    /**
     * Allow `.js` files to be imported outside of the root directory.
     * This is most likely an error, so it is `false` by default.
     * @default false
     */
    allowJsOutsideOfRoot: boolean | undefined;
    /**
     * The current directory used to resolve root, output, and file globs.
     */
    cwd: string | undefined;
    /**
     * Globs to exclude from processing.
     */
    exclude?: string[] | undefined;
    /**
     * Dry Run, do not actually write files.
     */
    dryRun: boolean;
    /**
     * The target directory, the default is to write in place.
     */
    output: string | undefined;
    /**
     * Report on progress.
     * @param message - message
     */
    progress: (message: string) => void;
    /**
     * Method to log warnings.
     * @param message - message to write
     * @returns
     */
    warning: ((message: string) => void) | undefined;
    /**
     * The root directory, files outside of the root will NOT be copied.
     */
    root: string | undefined;
    /**
     * Rename files to `.cjs` instead of `.mjs`.
     */
    cjs: boolean | undefined;
    /**
     * Remove the original files after successful conversion.
     * @default false
     */
    removeSource: boolean | undefined;
    /**
     * Skip all TypeScript files (.ts and .d.ts) instead of converting them.
     * @default false
     */
    skipTs: boolean | undefined;
}

export interface ProcessFilesResult {
    fileCount: number;
    skippedCount: number;
}

export async function processFiles(files: string[], options: Options): Promise<ProcessFilesResult> {
    const {
        output,
        root = process.cwd(),
        cwd = process.cwd(),
        dryRun,
        progress: logProgress,
        allowJsOutsideOfRoot = false,
        warning = console.warn,
        cjs = false,
        removeSource = false,
        skipTs = false,
    } = options;

    const ext = cjs ? '.cjs' : '.mjs';

    const filesWritten = new Map<string, Promise<void>>();

    const result: ProcessFilesResult = {
        fileCount: 0,
        skippedCount: 0,
    };

    const fromDir = path.resolve(cwd, root);
    const toDir = output ? path.resolve(cwd, output) : fromDir;

    function relName(filename: string): string {
        return path.relative(cwd, filename);
    }

    async function mkFileDir(filename: string) {
        if (dryRun) return;
        await mkdir(path.dirname(filename));
    }

    async function cp(src: string, dst: string) {
        if (src === dst) return;
        if (dryRun) return;
        // Copy will not overwrite a file that has already been written.
        if (filesWritten.has(dst)) return;
        const p = cpFile(src, dst);
        filesWritten.set(dst, p);
        await p;
    }

    async function writeFile(filename: string, content: string) {
        if (dryRun) return;
        // wait for any copies to finish before overwriting.
        await filesWritten.get(filename);
        const p = writeFileP(filename, content);
        filesWritten.set(filename, p);
        await p;
    }

    async function copyFile(filename: string) {
        if (fromDir === toDir) {
            return;
        }
        const src = path.resolve(fromDir, filename);
        const target = rebaseFile(src, fromDir, toDir);
        if (target === filename) return;
        logProgress(`${relName(src)} - ${chalk.yellow('copy')}`);
        await mkFileDir(target);
        await cp(src, target);
    }

    async function handleFile(filename: string) {
        const src = path.resolve(fromDir, filename);
        const filesToWrite = await processFile(src, {
            root: fromDir,
            target: toDir,
            ext,
            allowJsOutsideOfRoot,
            warning,
            skipTs,
        });
        for (const fileToWrite of filesToWrite) {
            const { filename, oldFilename, content } = fileToWrite;
            logProgress(`${relName(oldFilename)} -> ${relName(filename)} ${chalk.green('Generated')}`);
            await mkFileDir(filename);
            await writeFile(filename, content);
        }

        // Remove source file if conversion was successful and removeSource is enabled
        if (removeSource && !dryRun && filesToWrite.length > 0) {
            try {
                await fs.unlink(src);
                logProgress(`${relName(src)} - ${chalk.red('removed')}`);
            } catch (error) {
                warning?.(`Failed to remove source file ${relName(src)}: ${error}`);
            }
        }
    }

    const pending: Promise<void>[] = [];

    // Process files first
    for (const file of files) {
        const filename = path.resolve(cwd, file);
        if (!doesContain(fromDir, file)) continue;
        if (!isSupportedFileType(filename, ext, skipTs)) continue;
        pending.push(handleFile(filename));
    }

    // Copy files second
    for (const file of files) {
        const filename = path.resolve(cwd, file);
        if (!doesContain(fromDir, file)) continue;
        if (isSupportedFileType(filename, ext, skipTs)) continue;
        pending.push(copyFile(filename));
    }

    await Promise.all(pending);

    return result;
}

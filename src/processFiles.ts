import chalk from 'chalk';
import { promises as fs } from 'fs';
import * as path from 'path';

import { copyFile as cpFile, doesContain, mkdir, rebaseFile } from './fileUtils.js';
import { isSupportedFileType, processFile } from './processFile.js';

export interface Options {
    keep: boolean | undefined;
    output: string | undefined;
    root: string | undefined;
    cwd: string | undefined;
    progress: (message: string) => void;
    dryRun: boolean;
}

export interface ProcessFilesResult {
    fileCount: number;
    skippedCount: number;
}

export async function processFiles(files: string[], options: Options): Promise<ProcessFilesResult> {
    const { keep = false, output, root = process.cwd(), cwd = process.cwd(), dryRun, progress: logProgress } = options;

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
        !dryRun && (await mkdir(path.dirname(filename)));
    }

    async function cp(src: string, dst: string) {
        if (dryRun) return;
        // Copy will not overwrite a file that has already been written.
        if (filesWritten.has(dst)) return;
        const p = cpFile(src, dst);
        filesWritten.set(dst, p);
        await p;
    }

    async function rm(file: string) {
        !dryRun && (await fs.rm(file));
    }

    async function writeFile(filename: string, content: string) {
        if (dryRun) return;
        // wait for any copies to finish before overwriting.
        await filesWritten.get(filename);
        const p = fs.writeFile(filename, content, 'utf-8');
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

    async function removeSrcIfNecessary(filename: string) {
        if (keep || fromDir !== toDir) return;
        logProgress(`${relName(filename)} - ${chalk.yellow('renamed')}`);
        await rm(filename);
    }

    async function handleFile(filename: string) {
        const src = path.resolve(fromDir, filename);
        const filesToWrite = await processFile(src, fromDir, toDir);
        for (const fileToWrite of filesToWrite) {
            const { filename, oldFilename, content } = fileToWrite;
            logProgress(`${relName(oldFilename)} -> ${relName(filename)} ${chalk.green('Updated')}`);
            await mkFileDir(filename);
            writeFile(filename, content);
            if (filename !== oldFilename) {
                await removeSrcIfNecessary(src);
            }
        }
    }

    const pending: Promise<void>[] = [];

    // Process files first
    for (const file of files) {
        const filename = path.resolve(cwd, file);
        if (!doesContain(fromDir, file)) continue;
        if (!isSupportedFileType(filename)) continue;
        pending.push(handleFile(filename));
    }

    // Copy files second
    for (const file of files) {
        const filename = path.resolve(cwd, file);
        if (!doesContain(fromDir, file)) continue;
        if (isSupportedFileType(filename)) continue;
        pending.push(copyFile(filename));
    }

    await Promise.all(pending);

    return result;
}

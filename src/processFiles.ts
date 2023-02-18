import chalk from 'chalk';
import { promises as fs } from 'fs';
import * as path from 'path';

import { copyFile as cpFile, doesContain, mkdir, rebaseFile } from './fileUtils.js';
import { isSupportedFileType, processFile } from './processFile.js';
import { readSourceFile } from './readSourceFile.js';

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
        !dryRun && (await cpFile(src, dst));
    }

    async function rm(file: string) {
        !dryRun && (await fs.rm(file));
    }

    async function writeFile(filename: string, content: string) {
        !dryRun && (await fs.writeFile(filename, content, 'utf-8'));
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
        const srcFile = await readSourceFile(src);
        const result = processFile(srcFile, fromDir, toDir);
        const dst = rebaseFile(result.filename, fromDir, toDir);
        logProgress(`${relName(src)} -> ${relName(dst)} ${chalk.green('Updated')}`);
        await mkFileDir(dst);
        writeFile(dst, result.content);
        if (dst !== src) {
            await removeSrcIfNecessary(src);
        }
    }

    const pending: Promise<void>[] = [];

    for (const file of files) {
        const filename = path.resolve(cwd, file);
        if (!doesContain(fromDir, file)) continue;
        pending.push(!isSupportedFileType(filename) ? copyFile(filename) : handleFile(filename));
    }

    await Promise.all(pending);

    return result;
}

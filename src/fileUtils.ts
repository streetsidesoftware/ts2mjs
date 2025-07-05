import { promises as fs } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';

const regExpIsRelative = /^\.\.?[/\\]/;

/**
 * Check if a file is in a directory
 * @param root - absolute directory
 * @param filename - file / path to check.
 * @returns
 */
export function doesContain(root: string, filename: string): boolean {
    const rel = relative(root, resolve(root, filename));
    return !isAbsolute(rel) && !isRelativePath(rel);
}

/**
 * Check if a files starts with `./` or `../`
 * @param filename
 * @returns
 */
export function isRelativePath(filename: string): boolean {
    return regExpIsRelative.test(filename);
}

/**
 * Rebase a filename
 * @param filename - file in fromDir
 * @param fromDir - the starting directory
 * @param toDir - the target directory
 * @returns the new filename
 */
export function rebaseFile(filename: string, fromDir: string, toDir: string): string {
    const rel = relative(fromDir, resolve(fromDir, filename));
    if (isAbsolute(rel) || isRelativePath(rel)) return filename;
    return resolve(toDir, rel);
}

export async function copyFile(fromFile: string, toFile: string): Promise<void> {
    const buff = await fs.readFile(fromFile);
    await mkdir(dirname(toFile));
    await fs.writeFile(toFile, buff);
}

export async function mkdir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
}

export async function readFile(filename: string): Promise<string> {
    return fs.readFile(filename, 'utf8');
}

export async function writeFile(filename: string, content: string): Promise<void> {
    await mkdir(dirname(filename));
    await fs.writeFile(filename, content, 'utf8');
}

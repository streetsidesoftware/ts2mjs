import chalk from 'chalk';
import type { Command } from 'commander';
import { program as defaultCommand } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { UsageError } from './errors.js';
import { findFiles } from './findFiles.js';
import type { Options as ProcessFilesOptions } from './processFiles.js';
import { processFiles } from './processFiles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Package {
    name?: string;
    version?: string;
}

let _pkg: Promise<Package> | undefined;

function readPackage(): Promise<Package> {
    if (_pkg) return _pkg;

    const pkg = _readPackage();
    _pkg = pkg;
    return pkg;

    async function _readPackage(): Promise<Package> {
        const pathPackageJson = path.join(__dirname, '../package.json');
        const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
        return packageJson;
    }
}

async function version(): Promise<string> {
    const pkg = await readPackage();
    return pkg.version || '0.0.0';
}

async function getName(): Promise<string | undefined> {
    const pkg = await readPackage();
    return pkg.name;
}

interface CliOptions {
    mustFindFiles?: boolean;
    root?: string;
    cwd?: string;
    output?: string;
    color?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    enforceRoot?: boolean;
    cjs?: boolean;
    removeSource?: boolean;
    skipTs?: boolean;
    exclude: string[];
}

export interface AppLogger {
    log: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
}

export async function app(program = defaultCommand, logger?: AppLogger): Promise<Command> {
    const con = logger || console;

    program
        .name((await getName()) || 'ts2mjs')
        .description('Rename ESM .js files to .mjs (or .cjs if --cjs options is used)')
        .argument('<files...>', 'Globs matching files to rename.')
        .option('--cjs', 'Use .cjs extension instead of .mjs extension.')
        .option('-o, --output <dir>', 'The output directory.')
        .option('--cwd <dir>', 'The current working directory.')
        .option('--root <dir>', 'The root directory.')
        .option('-x,--exclude <glob>', 'Exclude a glob from the files.', concat, [])
        .option('--dry-run', 'Dry Run do not update files.')
        .option('--remove-source', 'Remove the original files after successful conversion.')
        .option('--skip-ts', 'Skip all TypeScript files (.ts and .d.ts) instead of converting them.')
        .option('--no-must-find-files', 'No error if files are not found.')
        .option('--no-enforce-root', 'Do not fail if relative `.js` files outside of the root are imported.')
        .option('--color', 'Force color.')
        .option('--no-color', 'Do not use color.')
        .option('-v, --verbose', 'Verbose mode')
        .version(await version())
        .action(async (globs: string[], optionsCli: CliOptions, _command: Command) => {
            // console.log('Options: %o', optionsCli);
            program.showHelpAfterError(false);
            if (optionsCli.color !== undefined) {
                chalk.level = optionsCli.color ? 3 : 0;
            }
            const cwd = optionsCli.cwd || process.cwd();
            const exclude = optionsCli.exclude;
            const files = (await findFiles(globs, { cwd, exclude })).map((file) => path.resolve(cwd, file));
            if (!files.length && optionsCli.mustFindFiles) {
                program.error('No files found.');
            }
            function log(msg: string) {
                if (optionsCli.dryRun || optionsCli.verbose) {
                    con.log(msg);
                }
            }
            function warning(msg: string) {
                con.error(chalk.yellowBright('Warning: ') + msg);
            }
            const processOptions: ProcessFilesOptions = {
                cwd: optionsCli.cwd,
                dryRun: optionsCli.dryRun || false,
                output: optionsCli.output,
                cjs: optionsCli.cjs,
                exclude: optionsCli.exclude,
                progress: log,
                warning,
                root: optionsCli.root,
                allowJsOutsideOfRoot: !(optionsCli.enforceRoot ?? true),
                removeSource: optionsCli.removeSource,
                skipTs: optionsCli.skipTs,
            };
            await processFiles(files, processOptions);
            log(chalk.green('done.'));
        });

    program.showHelpAfterError();
    return program;
}

export async function run(argv?: string[], program?: Command, logger?: AppLogger): Promise<void> {
    const con = logger || console;
    const prog = await app(program, logger);
    try {
        await prog.parseAsync(argv);
    } catch (e) {
        if (e instanceof UsageError) {
            con.error(chalk.red('Error: ') + e.message);
            process.exitCode = process.exitCode || 1;
            return;
        }
        throw e;
    }
}

function concat(value: string, prev: string[]): string[] {
    return prev.concat(value);
}

import { Command, CommanderError } from 'commander';
import { relative } from 'path';
import { format } from 'util';
import { afterEach, describe, expect, type Mock, test, vi } from 'vitest';

import { run as runApp } from './app.js';
import { resolveTempUnique } from './test.util.js';

// const oc = (a: object) => expect.objectContaining(a);
const sc = (s: string) => expect.stringContaining(s);
const sm = (s: string | RegExp) => expect.stringMatching(s);

describe('app', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test.each`
        args                                                            | expectedOutputs
        ${['.', '--root=fixtures/sample/lib', '--output=temp']}         | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('index.js.map - copy'), sc('done.')]}
        ${['.', '--cwd=fixtures/sample/lib', '--output=../../../temp']} | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('index.js.map - copy'), sc('done.')]}
        ${['fixtures/sample/lib']}                                      | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('done.')]}
        ${['fixtures/sample/lib']}                                      | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('done.')]}
        ${['not_found', '--no-must-find-files']}                        | ${[sc('done.')]}
    `('run (--dry-run) $args', async ({ args, expectedOutputs }: { args: string[]; expectedOutputs: unknown[] }) => {
        const argv = genArgv(args);
        const context = createRunContext();
        await expect(run(argv, context)).resolves.toBeUndefined();
        const output = context.output();
        for (const expected of expectedOutputs) {
            expect(output).toEqual(expected);
        }
        expect(output).toMatchSnapshot();
    });

    test.each`
        args                               | expectedOutputs
        ${['.', '--root=fixtures/sample']} | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('index.js.map - copy'), sc('done.')]}
    `('run (actual) $args', async ({ args, expectedOutputs }: { args: string[]; expectedOutputs: unknown[] }) => {
        const tempDir = relative(process.cwd(), resolveTempUnique());
        const argv = genArgv([...args, `--output=${tempDir}`], { dryRun: false });
        const context = createRunContext();
        await expect(run(argv, context)).resolves.toBeUndefined();
        const output = context.output({ replacements: [tempDir, 'temp'] });
        for (const expected of expectedOutputs) {
            expect(output).toEqual(expected);
        }
        expect(output).toMatchSnapshot();
    });

    test.each`
        args
        ${['.', '--root=fixtures/sample/lib/database']}
        ${['.', '--root=fixtures/sample/lib/database', '--no-enforce-root']}
    `('run (actual) (errors and warnings) $args', async ({ args }) => {
        const tempDir = relative(process.cwd(), resolveTempUnique());
        const argv = genArgv([...args, `--output=${tempDir}`], { dryRun: false });
        const context = createRunContext();
        await expect(run(argv, context)).resolves.toBeUndefined();
        const output = context.output({ replacements: [tempDir, 'temp'] });
        expect(output).toMatchSnapshot();
    });

    test.each`
        args
        ${'--help'}
    `('run error $args', async ({ args }) => {
        const argv = genArgv(args);
        const context = createRunContext();
        await expect(run(argv, context)).rejects.toBeInstanceOf(CommanderError);
    });
});

function genArgv(args: string | string[], { dryRun = true, color = false, verbose = true } = {}): string[] {
    args = typeof args === 'string' ? [args] : args;
    const defaultArgs: string[] = [];
    dryRun && defaultArgs.push('--dry-run');
    defaultArgs.push(color ? '--color' : '--no-color');
    verbose && defaultArgs.push('--verbose');
    const argv: string[] = [process.argv[0], 'bin.mjs', ...defaultArgs, ...args];
    return argv;
}

interface FormatOptions {
    sort?: boolean;
    replacements?: [oldVal: string, newVal: string];
}

function formatOutput(logger: AppLogger, { sort, replacements }: FormatOptions = {}): string {
    return `\
Console Output:
${prefix(outputToString(logger.log.mock.calls, sort, replacements), '[log]: ')}
${prefix(outputToString(logger.warn.mock.calls, sort, replacements), '[warn]: ')}
${prefix(outputToString(logger.error.mock.calls, sort, replacements), '[error]: ')}
`;
}

function prefix(text: string, pfx: string): string {
    return pfx + text.split('\n').join('\n' + pfx);
}

function outputToString(calls: unknown[][], sort = true, replacements?: [oldVal: string, newVal: string]): string {
    const callLines = calls.map((call) => call.join('|'));
    if (sort) {
        callLines.sort();
    }
    const output = callLines.join('\n');
    const adjusted = replacements ? replaceAll(output, replacements[0], replacements[1]) : output;
    return adjusted.replace(/\\/g, '/');
}

function replaceAll(text: string, replace: string, withValue: string): string {
    const result = text.split(replace).join(withValue);
    if (/\.\d{3}Z/.test(result)) {
        process.stderr.write(format('%o', { text, replace, withValue, result }));
    }
    return result;
}

interface AppLogger {
    log: Mock<[string], void>;
    warn: Mock<[string], void>;
    error: Mock<[string], void>;
}

function getAppLogger(): AppLogger {
    return {
        log: vi.fn<[string], void>(),
        warn: vi.fn<[string], void>(),
        error: vi.fn<[string], void>(),
    };
}

function run(argv: string[], context: RunContext) {
    return runApp(argv, context.program, context.logger);
}

interface RunContext {
    program: Command;
    logger: AppLogger;
    output: (options?: FormatOptions) => string;
}

function createRunContext(): RunContext {
    const program = new Command();
    program.exitOverride((e) => {
        throw e;
    });
    const logger = getAppLogger();

    function output(opts?: FormatOptions) {
        return formatOutput(logger, opts);
    }

    return {
        logger,
        program,
        output,
    };
}

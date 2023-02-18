import { Command, CommanderError } from 'commander';
import { relative } from 'path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { run } from './app.js';
import { resolveTempUnique } from './test.util.js';

// const oc = (a: object) => expect.objectContaining(a);
const sc = (s: string) => expect.stringContaining(s);
const sm = (s: string | RegExp) => expect.stringMatching(s);

describe('app', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test.each`
        args                                                    | expectedOutputs
        ${['.', '--root=fixtures/sample/lib', '--output=temp']} | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('index.js.map - copy'), sc('done.')]}
        ${['fixtures/sample/lib']}                              | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('done.')]}
        ${['fixtures/sample/lib']}                              | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('done.')]}
        ${['not_found', '--no-must-find-files']}                | ${['done.']}
    `('run (--dry-run) $args', async ({ args, expectedOutputs }: { args: string[]; expectedOutputs: unknown[] }) => {
        const argv = genArgv(args);
        const program = new Command();
        program.exitOverride((e) => {
            throw e;
        });
        const spyLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        await expect(run(argv, program)).resolves.toBeUndefined();
        const output = outputToString(spyLog.mock.calls);
        for (const expected of expectedOutputs) {
            expect(output).toEqual(expected);
        }
        expect(output).toMatchSnapshot();
    });

    test.each`
        args                                   | expectedOutputs
        ${['.', '--root=fixtures/sample/lib']} | ${[sm(/index.js\b.*\bindex.mjs Generated/), sc('index.js.map - copy'), sc('done.')]}
    `('run (actual) $args', async ({ args, expectedOutputs }: { args: string[]; expectedOutputs: unknown[] }) => {
        const tempDir = relative(process.cwd(), resolveTempUnique());
        const argv = genArgv([...args, `--output=${tempDir}`], false);
        const program = new Command();
        program.exitOverride((e) => {
            throw e;
        });
        const spyLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        await expect(run(argv, program)).resolves.toBeUndefined();
        const output = outputToString(spyLog.mock.calls, true, [tempDir, 'temp']);
        for (const expected of expectedOutputs) {
            expect(output).toEqual(expected);
        }
        expect(output).toMatchSnapshot();
    });

    test.each`
        args
        ${'--help'}
    `('run error $args', async ({ args }) => {
        const argv = genArgv(args);
        const program = new Command();
        program.exitOverride((e) => {
            throw e;
        });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        await expect(run(argv, program)).rejects.toBeInstanceOf(CommanderError);
    });
});

function genArgv(args: string | string[], dryRun = true): string[] {
    args = typeof args === 'string' ? [args] : args;
    const defaultArgs = dryRun ? ['--dry-run'] : [];
    const argv: string[] = [process.argv[0], 'bin.mjs', ...args, '--verbose', '--no-color', ...defaultArgs];
    return argv;
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
    return text.split(replace).join(withValue);
}

import { Command, CommanderError } from 'commander';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { run } from './app.js';

// const oc = (a: object) => expect.objectContaining(a);
const sc = (s: string) => expect.stringContaining(s);
const sNc = (s: string) => expect.not.stringContaining(s);
const sm = (s: string | RegExp) => expect.stringMatching(s);
// const ac = <T>(a: T[]) => expect.arrayContaining(a);

describe('app', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test.each`
        args                                                    | expectedOutputs
        ${['.', '--root=dist', '--output=temp']}                | ${[sm(/app.js\b.*\bapp.mjs/), sc('done.')]}
        ${['.', '--root=fixtures/sample/lib', '--output=temp']} | ${[sm(/index.js\b.*\bindex.mjs Updated/), sc('index.js.map - copy'), sc('done.')]}
        ${['fixtures/sample/lib']}                              | ${[sm(/index.js\b.*\bindex.mjs Updated/), sc('index.js - renamed'), sc('done.')]}
        ${['fixtures/sample/lib', '--keep']}                    | ${[sm(/index.js\b.*\bindex.mjs Updated/), sNc('index.js - renamed'), sc('done.')]}
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
        args                                                    | expectedOutputs
        ${['.', '--root=fixtures/sample/lib', '--output=temp']} | ${[sm(/index.js\b.*\bindex.mjs Updated/), sc('index.js.map - copy'), sc('done.')]}
    `('run (actual) $args', async ({ args, expectedOutputs }: { args: string[]; expectedOutputs: unknown[] }) => {
        const argv = genArgv(args, false);
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

function outputToString(calls: unknown[][], sort = true): string {
    const callLines = calls.map((call) => call.join('|'));
    if (sort) {
        callLines.sort();
    }
    return callLines.join('\n').replace(/\\/g, '/');
}

export type { MagicStringOptions } from 'magic-string';
export { SourceMap, SourceMapOptions } from 'magic-string';

import type { MagicStringOptions, SourceMapOptions } from 'magic-string';
import type { SourceMap } from 'magic-string';

export interface MagicString {
    update: (start: number, end: number, value: string) => MagicString;
    generateMap: (options?: SourceMapOptions) => SourceMap;
}

export function createMagicString(doc: string, options?: MagicStringOptions): MagicString;

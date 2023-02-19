export { SourceMap } from 'magic-string';

import MagicStringCls from 'magic-string';

export function createMagicString(doc, options) {
    return new MagicStringCls(doc, options);
}

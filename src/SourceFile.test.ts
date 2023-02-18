import { describe, expect, test } from 'vitest';

import * as SourceFile from './SourceFile.js';

describe('SourceFile', () => {
    test('SourceFile Api', () => {
        expect(SourceFile).toMatchSnapshot();
    });
});

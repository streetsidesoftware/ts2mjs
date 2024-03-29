# ts2mjs

Rename TypeScript created ESM .js files to .mjs

This tool takes output from `tsc` and copies/renames the files.

- `file.js` => `file.mjs`
- `file.js.map` => `file.mjs.map`
- `file.d.ts` => `file.d.mts`
- `file.d.ts.map` => `file.d.mts.map`

**`dist/code.js` -> `dist/code.mjs`**

```diff
import * as path from 'path';
import { lib } from 'package/lib/index.js'
-import { findFiles } from './findFiles.js';
+import { findFiles } from './findFiles.mjs';
```

**`dist/index.d.ts` -> `dist/index.d.mts`**

```diff
-export { PrimeNumber, Tuple, GUID, Address, Person, Annotation, } from './types.js';
+export { PrimeNumber, Tuple, GUID, Address, Person, Annotation, } from './types.mjs';
-export { lookUpPerson } from './lookup.js';
+export { lookUpPerson } from './lookup.mjs';
```

## Usage

This is an example on how to create a package that exports both CommonJS and ESM from TypeScript source.

**`tsconfig.esm.json`**

```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/node18/tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "dist/esm",
    "sourceMap": true
  },
  "include": ["src"]
}
```

**`tsconfig.cjs.json`**

```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/node18/tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist/cjs",
    "sourceMap": true
  },
  "include": ["src"]
}
```

**`package.json`**

```json
{
  "type": "commonjs",
  "main": "dist/csj/index.js",
  "module": "dist/esm/index.mjs",
  "types": "dist/cjs/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/esm/index.mjs",
      "require": "./dist/cjs/index.js"
    }
  }
}
```

```sh
tsc -p tsconfig.cjs.json
tsc -p tsconfig.esm.json
ts2mjs dist/esm
```

## Help

<!--- @@inject: static/help.txt --->

```
Usage: ts2mjs [options] <files...>

Rename ESM .js files to .mjs

Arguments:
  files                 The files to rename.

Options:
  -o, --output <dir>    The output directory.
  --cwd <dir>           The current working directory.
  --root <dir>          The root directory.
  --dry-run             Dry Run do not update files.
  --no-must-find-files  No error if files are not found.
  --no-enforce-root     Do not fail if relative `.js` files outside of the root
                        are imported.
  --color               Force color.
  --no-color            Do not use color.
  -v, --verbose         Verbose mode
  -V, --version         output the version number
  -h, --help            display help for command
```

<!--- @@inject-end: static/help.txt --->

<!--- @@inject: https://raw.githubusercontent.com/streetsidesoftware/cspell/main/static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: https://raw.githubusercontent.com/streetsidesoftware/cspell/main/static/footer.md --->

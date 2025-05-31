# ts2mjs

Rename TypeScript created ESM .js files to .mjs

This tool takes output from `tsc` and copies/renames the files.

- `file.js` => `file.mjs`
- `file.js.map` => `file.mjs.map`
- `file.d.ts` => `file.d.mts`
- `file.d.ts.map` => `file.d.mts.map`
- `file.ts` => `file.mts` (by default, can be skipped with `--skip-ts`)

## CommonJS Support

Use the `--cjs` flag to generate CommonJS extensions instead:

- `file.js` => `file.cjs`
- `file.js.map` => `file.cjs.map`
- `file.d.ts` => `file.d.cts`
- `file.d.ts.map` => `file.d.cts.map`
- `file.ts` => `file.cts` (by default, can be skipped with `--skip-ts`)

## Key Features

### 🔄 **Import/Export Rewriting**
Automatically updates relative imports and exports in your files:

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

### 🗑️ **Source File Removal**
Use `--remove-source` to automatically delete original files after successful conversion:

```sh
ts2mjs dist/esm --remove-source
# Original .js files are deleted after being converted to .mjs
```

### 🚫 **TypeScript File Skipping**
Use `--skip-ts` to ignore TypeScript files instead of converting them:

```sh
ts2mjs dist/esm --skip-ts
# .ts and .d.ts files are left unchanged, only .js files are processed
```

## Options

- **`--cjs`** - Generate `.cjs` extensions instead of `.mjs`
- **`--remove-source`** - Remove original files after successful conversion
- **`--skip-ts`** - Skip all TypeScript files (`.ts` and `.d.ts`) instead of converting them
- **`--dry-run`** - Preview changes without making them
- **`--verbose`** - Show detailed output
- **`-o, --output <dir>`** - Specify output directory (default: in-place)
- **`--root <dir>`** - Set the root directory for processing

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

### Build Commands

```sh
# Build both CommonJS and ESM
tsc -p tsconfig.cjs.json
tsc -p tsconfig.esm.json

# Convert ESM output to .mjs
ts2mjs dist/esm

# Convert CJS TypeScript files to .cts (if needed)
ts2mjs dist/cjs --cjs

# Advanced usage examples
ts2mjs dist/esm --remove-source  # Delete original files after conversion
ts2mjs dist/esm --skip-ts        # Only process .js files, skip .ts/.d.ts
ts2mjs dist/esm --dry-run --verbose  # Preview changes with detailed output
```

## Help

<!--- @@inject: static/help.txt --->

```
Usage: ts2mjs [options] <files...>

Rename ESM .js files to .mjs (or .cjs if --cjs options is used)

Arguments:
  files                 Globs matching files to rename.

Options:
  --cjs                 Use .cjs extension instead of .mjs extension.
  -o, --output <dir>    The output directory.
  --cwd <dir>           The current working directory.
  --root <dir>          The root directory.
  -x,--exclude <glob>   Exclude a glob from the files. (default: [])
  --dry-run             Dry Run do not update files.
  --remove-source       Remove the original files after successful conversion.
  --skip-ts             Skip all TypeScript files (.ts and .d.ts) instead of
                        converting them.
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

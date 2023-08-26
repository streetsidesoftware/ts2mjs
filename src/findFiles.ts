import { globby, type Options as GlobbyOptions } from 'globby';

const excludes = ['node_modules'];

export interface FindFileOptions {
    onlyFiles?: boolean | undefined;
    cwd?: string | undefined;
    /** glob patterns of files to exclude. */
    exclude?: string[] | undefined;
}

export async function findFiles(globs: string[], options: FindFileOptions) {
    console.warn('options: %o', options);
    const globOptions: GlobbyOptions = {
        ignore: excludes.concat(options.exclude || []),
        onlyFiles: options.onlyFiles ?? true,
        cwd: options.cwd || process.cwd(),
    };
    const files = await globby(
        globs.map((a) => a.trim()).filter((a) => !!a),
        globOptions,
    );
    // console.log('%o', files);
    return files;
}

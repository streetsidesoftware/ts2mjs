export interface SourceFile {
    srcFilename: string;
    content: string;
    mappings?: SourceMap | undefined;
}

export interface SourceMap {
    url: URL;
    mappings: string;
}

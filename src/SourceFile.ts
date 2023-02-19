export interface SourceFile {
    srcFilename: string;
    content: string;
    map?: SourceMap | undefined;
}

export interface SourceMap {
    url: URL;
    map: string;
}

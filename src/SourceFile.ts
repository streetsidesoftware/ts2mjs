export interface SourceFile {
    srcFilename: string;
    content: string;
    mappings?: string | undefined;
}

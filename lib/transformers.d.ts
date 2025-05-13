import ts from "typescript";
import { SourceLinkerOptions } from "./types.js";
export declare function jsxTransformerFactory(opts: SourceLinkerOptions): (context: ts.TransformationContext) => (source: ts.SourceFile) => ts.SourceFile;

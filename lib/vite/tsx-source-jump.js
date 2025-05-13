import ts from "typescript";
import { jsxTransformerFactory } from "../transformers.js";
const printer = ts.createPrinter();
export function tsxSourceJump(opts) {
    return {
        enforce: "pre",
        transform(code, id) {
            if (id.endsWith(".tsx")) {
                const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
                const out = ts.transform(source, [jsxTransformerFactory(opts)]);
                const printed = printer.printNode(ts.EmitHint.SourceFile, out.transformed[0], out.transformed[0]);
                return printed;
            }
        },
    };
}

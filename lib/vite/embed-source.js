export function embedSource() {
    return {
        enforce: "pre",
        transform(code, id) {
            if (id.endsWith(".ts") || id.endsWith(".tsx")) {
                const escaped = encodeURIComponent(code);
                return (code +
                    `\n//@ts-ignore\n(globalThis.__files||={})['${id}'] = decodeURIComponent("${escaped}");`);
            }
        },
    };
}

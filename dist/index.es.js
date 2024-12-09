import ts, { factory } from 'typescript';
import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

function findOwnerComponent(node) {
  let cur = node;
  while (cur.parent) {
    if (ts.isFunctionDeclaration(cur))
      return cur;
    if (ts.isSourceFile(cur))
      return null;
    cur = cur.parent;
  }
  return null;
}
function jsxTransformerFactory(opts) {
  return (context) => {
    const __visitNode = (node) => {
      const newNode = ts.visitEachChild(node, __visitNode, context);
      if (ts.isJsxOpeningElement(newNode) || ts.isJsxSelfClosingElement(newNode)) {
        return appendSourceMapAttribute(opts, newNode);
      }
      return newNode;
    };
    return (source) => {
      return ts.factory.updateSourceFile(source, ts.visitNodes(source.statements, __visitNode));
    };
  };
}
const defaultTarget = [/^[a-z]+$/];
function appendSourceMapAttribute(opts, node) {
  if (ts.isIdentifier(node.tagName)) {
    const tagName = node.tagName.getText();
    const target = opts.target ?? defaultTarget;
    if (!target.some((t) => t.test(tagName)))
      return node;
    const source = node.getSourceFile();
    const fileName = source.fileName;
    const position = ts.getLineAndCharacterOfPosition(source, node.getStart(source));
    const factoryMethod = node.kind === ts.SyntaxKind.JsxOpeningElement ? factory.createJsxOpeningElement : factory.createJsxSelfClosingElement;
    const owner = findOwnerComponent(node);
    const displayText = `${fileName.replace(opts.projectRoot, "")}:${position.line + 1}:${position.character + 1}${owner ? ` | [${owner.name?.getText()}]` : ""}`;
    let inlineCode = null;
    if (opts.inlineCode) {
      inlineCode = node.getText();
    }
    return factoryMethod(node.tagName, node.typeArguments, factory.updateJsxAttributes(node.attributes, [
      ...node.attributes.properties,
      factory.createJsxAttribute(factory.createIdentifier("data-sj-path"), factory.createStringLiteral(`idea://open?file=${encodeURIComponent(fileName)}&line=${position.line + 1}&column=${position.character + 1}`)),
      factory.createJsxAttribute(factory.createIdentifier("data-sj-display-name"), factory.createStringLiteral(displayText)),
      ...inlineCode ? [
        factory.createJsxAttribute(factory.createIdentifier("data-sj-code"), factory.createStringLiteral(encodeURIComponent(inlineCode)))
      ] : []
    ]));
  }
  return node;
}

const printer = ts.createPrinter();
function tsxSourceJump(opts) {
  return {
    enforce: "pre",
    transform(code, id) {
      if (id.endsWith(".tsx")) {
        const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const out = ts.transform(source, [jsxTransformerFactory(opts)]);
        const printed = printer.printNode(ts.EmitHint.SourceFile, out.transformed[0], out.transformed[0]);
        return printed;
      }
    }
  };
}

function embedSource() {
  return {
    enforce: "pre",
    transform(code, id) {
      if (id.endsWith(".ts") || id.endsWith(".tsx")) {
        const escaped = encodeURIComponent(code);
        return code + `
//@ts-ignore
(globalThis.__files||={})['${id}'] = decodeURIComponent("${escaped}");`;
      }
    }
  };
}

function useMouseOverElementRef() {
  const [element, setElement] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);
  useEffect(() => {
    let timeout = null;
    const resetHandler = () => {
      if (timeout != null)
        clearTimeout(timeout);
      !isScrolling && setIsScrolling(true);
      timeout = setTimeout(() => {
        setIsScrolling(false);
        timeout = null;
      }, 100);
    };
    const mouseOverHandler = (ev) => {
      if (ev.target instanceof HTMLElement) {
        if (ev.target.closest("[data-sj-ui]"))
          return;
        let target = ev.target;
        if (!target.dataset.sjPath) {
          target = target.closest("[data-sj-path]");
        }
        if (target == null) {
          setElement(null);
        } else if (element !== target) {
          setElement(ev.target);
        }
      }
    };
    addEventListener("mouseover", mouseOverHandler);
    addEventListener("scroll", resetHandler);
    addEventListener("resize", resetHandler);
    return () => {
      removeEventListener("mouseover", mouseOverHandler);
      removeEventListener("scroll", resetHandler);
      removeEventListener("resize", resetHandler);
    };
  }, []);
  if (isScrolling)
    return null;
  return element;
}
function SourceJumpOverlay() {
  const ref = useRef(null);
  const element = useMouseOverElementRef();
  const [active, setActive] = useState(false);
  const [sourceData, setSourceData] = useState(null);
  useEffect(() => {
    const blurHandler = () => {
      setActive(false);
    };
    const keyDownHandler = (ev) => {
      if (ev.key === "Shift")
        setActive(true);
    };
    const keyUpHandler = (ev) => {
      if (ev.key === "Shift")
        setActive(false);
    };
    addEventListener("blur", blurHandler);
    addEventListener("keydown", keyDownHandler);
    addEventListener("keyup", keyUpHandler);
    return () => {
      removeEventListener("blur", blurHandler);
      removeEventListener("keydown", keyDownHandler);
      removeEventListener("keyup", keyUpHandler);
    };
  }, []);
  useEffect(() => {
    if (!element)
      return;
    if (!ref.current)
      return;
    const rect = element.getBoundingClientRect();
    setSourceData({
      rect,
      sjPath: element.dataset.sjPath,
      sjDisplayName: element.dataset.sjDisplayName,
      sjCode: element.dataset.sjCode && decodeURIComponent(element.dataset.sjCode)
    });
  }, [element, setSourceData, ref]);
  const isVisible = element && active;
  return /* @__PURE__ */ React.createElement("div", {
    ref,
    style: {
      position: "fixed",
      background: "rgba(255,255,0,0.1)",
      visibility: isVisible ? "visible" : "hidden",
      display: "grid",
      placeItems: "center",
      userSelect: "none",
      pointerEvents: "none",
      outline: "0.2rem dotted gray",
      boxSizing: "border-box",
      isolation: "isolate",
      left: sourceData?.rect.left,
      top: sourceData?.rect.top,
      width: sourceData?.rect.width,
      height: sourceData?.rect.height,
      cursor: "pointer"
    }
  }, /* @__PURE__ */ React.createElement("div", {
    style: {
      background: "rgba(0,0,255,0.5)",
      color: "#fff",
      padding: 5,
      zIndex: 1e4,
      borderRadius: 4,
      pointerEvents: "auto"
    },
    onClick: () => {
      const el = document.createElement("a");
      el.href = sourceData?.sjPath;
      el.click();
    }
  }, "\u{1F517} ", sourceData?.sjDisplayName), sourceData?.sjCode && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      right: 0,
      bottom: 0,
      fontFamily: "menlo, monospace",
      background: "rgba(0,0,255,0.8)",
      color: "white",
      borderRadius: 2,
      padding: 3,
      boxSizing: "border-box",
      zIndex: 1e4,
      width: "100%",
      overflow: "scroll"
    }
  }, /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, sourceData?.sjCode))));
}
function SourceJumpOverlayPortal() {
  const [element, setElement] = useState(null);
  useEffect(() => {
    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed";
    tooltip.style.top = "0";
    tooltip.style.left = "0";
    tooltip.style.width = "100%";
    tooltip.style.height = "100%";
    tooltip.style.zIndex = "2147483647";
    tooltip.style.pointerEvents = "none";
    tooltip.dataset.sjUi = "true";
    document.body.appendChild(tooltip);
    setElement(tooltip);
    return () => {
      setElement(null);
      tooltip.remove();
    };
  }, []);
  if (element == null)
    return /* @__PURE__ */ React.createElement(React.Fragment, null);
  return ReactDOM.createPortal(/* @__PURE__ */ React.createElement(SourceJumpOverlay, null), element);
}

export { SourceJumpOverlay, SourceJumpOverlayPortal, embedSource, tsxSourceJump };

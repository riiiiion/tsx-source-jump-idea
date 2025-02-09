import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";

function useMouseOverElementRef(): HTMLElement | null {
  const [element, setElement] = useState<null | HTMLElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const resetHandler = () => {
      if (timeout != null) clearTimeout(timeout);
      !isScrolling && setIsScrolling(true);
      timeout = setTimeout(() => {
        setIsScrolling(false);
        timeout = null;
      }, 100);
    };

    const mouseOverHandler = (ev: MouseEvent) => {
      if (ev.target instanceof HTMLElement) {
        if (ev.target.closest("[data-sj-ui]")) return;
        let target = ev.target;
        if (!target.dataset.sjPath) {
          target = target.closest("[data-sj-path]") as HTMLElement;
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

  if (isScrolling) return null;
  return element;
}

export function SourceJumpOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const element = useMouseOverElementRef();
  const [active, setActive] = useState(false);

  const [sourceData, setSourceData] = useState<null | {
    rect: DOMRect;
    sjPath: string;
    sjDisplayName: string;
    sjCode?: string;
  }>(null);

  useEffect(() => {
    const blurHandler = () => {
      setActive(false);
    };

    const keyDownHandler = (ev: KeyboardEvent) => {
      if (ev.shiftKey && ev.altKey) setActive(true);
    };
    const keyUpHandler = (ev: KeyboardEvent) => {
      if (ev.shiftKey && ev.altKey) setActive(false);
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
    if (!element) return;
    if (!ref.current) return;
    const rect = element.getBoundingClientRect();
    setSourceData({
      rect,
      sjPath: element.dataset.sjPath!,
      sjDisplayName: element.dataset.sjDisplayName!,
      sjCode:
        element.dataset.sjCode && decodeURIComponent(element.dataset.sjCode),
    });
  }, [element, setSourceData, ref]);

  const isVisible = element && active;
  return (
    <div
      ref={ref}
      style={{
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
        cursor: "pointer",
      }}
    >
      {/* <div style={{ position: "relative", width: "100%", height: "100%" }}> */}
      <div
        style={{
          background: "rgba(0,0,255,0.5)",
          color: "#fff",
          padding: 5,
          zIndex: 10000,
          borderRadius: 4,
          pointerEvents: "auto",
        }}
        onClick={() => {
          const el = document.createElement("a");
          el.href = sourceData?.sjPath!;
          el.click();
        }}
      >
        🔗 {sourceData?.sjDisplayName}
      </div>
      {sourceData?.sjCode && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            fontFamily: "menlo, monospace",
            background: "rgba(0,0,255,0.8)",
            color: "white",
            borderRadius: 2,
            padding: 3,
            boxSizing: "border-box",
            zIndex: 10000,
            width: "100%",
            overflow: "scroll",
          }}
        >
          <pre>
            <code>{sourceData?.sjCode}</code>
          </pre>
        </div>
      )}
      {/* </div> */}
    </div>
  );
}

export function SourceJumpOverlayPortal() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed"; // スタッキングコンテキストを作成
    tooltip.style.top = "0";
    tooltip.style.left = "0";
    tooltip.style.width = "100%";
    tooltip.style.height = "100%";
    tooltip.style.zIndex = "2147483647"; // 最大のz-index
    tooltip.style.pointerEvents = "none"; // 他の要素にイベントを通す
    tooltip.dataset.sjUi = "true";
    document.body.appendChild(tooltip);
    setElement(tooltip);
    return () => {
      setElement(null);
      tooltip.remove();
    };
  }, []);
  if (element == null) return <></>;
  return ReactDOM.createPortal(<SourceJumpOverlay />, element);
}

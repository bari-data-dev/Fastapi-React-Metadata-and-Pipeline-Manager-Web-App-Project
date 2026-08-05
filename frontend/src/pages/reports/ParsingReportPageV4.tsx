import { useEffect, useRef } from "react";
import ParsingReportPageV3 from "./ParsingReportPageV3";

const DETAIL_TABLE_CLASSES = ["min-w-[1550px]", "min-w-[1350px]"];

function enhanceReportTable(root: HTMLElement) {
  const detailTable = Array.from(root.querySelectorAll<HTMLTableElement>("table")).find(
    (table) =>
      DETAIL_TABLE_CLASSES.some((className) =>
        table.classList.contains(className)
      )
  );

  if (detailTable?.parentElement) {
    const container = detailTable.parentElement;
    container.dataset.reportDetailScroll = "true";
    container.classList.add(
      "max-h-[62dvh]",
      "w-full",
      "touch-auto",
      "overflow-auto",
      "overscroll-contain",
      "rounded-md",
      "border",
      "sm:max-h-[68vh]"
    );
    container.style.maxHeight = window.matchMedia("(min-width: 640px)").matches
      ? "68vh"
      : "62dvh";
    container.style.overflow = "auto";
  }

  const pageSizeSelect = Array.from(
    root.querySelectorAll<HTMLSelectElement>("select")
  ).find((select) => {
    const values = Array.from(select.options).map((option) => option.value);
    return ["25", "50", "100", "200"].every((value) =>
      values.includes(value)
    );
  });

  if (pageSizeSelect) {
    pageSizeSelect.hidden = true;
    pageSizeSelect.tabIndex = -1;
    pageSizeSelect.setAttribute("aria-hidden", "true");

    const parent = pageSizeSelect.parentElement;
    if (parent && !parent.querySelector("[data-report-page-size-label]")) {
      const label = document.createElement("span");
      label.dataset.reportPageSizeLabel = "true";
      label.className =
        "inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium";
      label.textContent = "10 row / page";
      parent.appendChild(label);
    }
  }
}

export default function ParsingReportPageV4() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const scheduleEnhancement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => enhanceReportTable(root));
    };

    scheduleEnhancement();

    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", scheduleEnhancement);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleEnhancement);
    };
  }, []);

  return (
    <div ref={rootRef} className="min-w-0">
      <ParsingReportPageV3 />
    </div>
  );
}

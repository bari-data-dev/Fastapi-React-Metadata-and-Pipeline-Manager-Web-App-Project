import { useEffect, useRef } from "react";
import ParsingReportPageV3 from "./ParsingReportPageV3";

const DETAIL_TABLE_CLASSES = ["min-w-[1550px]", "min-w-[1350px]"];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
const PAGE_WINDOW_SIZE = 5;

function findDetailTable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLTableElement>("table")).find(
    (table) =>
      DETAIL_TABLE_CLASSES.some((className) =>
        table.classList.contains(className)
      )
  );
}

function enhanceReportTableScroll(root: HTMLElement) {
  const detailTable = findDetailTable(root);
  if (!detailTable?.parentElement) return;

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

function findPageSizeSelect(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLSelectElement>("select")).find(
    (select) => {
      const values = Array.from(select.options).map((option) => option.value);
      return ["25", "50", "100", "200"].every((value) =>
        values.includes(value)
      );
    }
  );
}

function enhancePageSizeSelector(root: HTMLElement) {
  const pageSizeSelect = findPageSizeSelect(root);
  if (!pageSizeSelect) return;

  root.querySelector("[data-report-page-size-label]")?.remove();

  if (!Array.from(pageSizeSelect.options).some((option) => option.value === "10")) {
    const option = document.createElement("option");
    option.value = "10";
    option.textContent = "10";
    pageSizeSelect.insertBefore(option, pageSizeSelect.firstChild);
  }

  pageSizeSelect.hidden = false;
  pageSizeSelect.tabIndex = 0;
  pageSizeSelect.removeAttribute("aria-hidden");
  pageSizeSelect.className =
    "h-9 min-w-20 rounded-md border bg-background px-2 text-sm";

  const parent = pageSizeSelect.parentElement;
  if (parent && !parent.querySelector("[data-report-rows-label]")) {
    const label = document.createElement("span");
    label.dataset.reportRowsLabel = "true";
    label.className = "text-sm text-muted-foreground";
    label.textContent = "Rows";
    parent.insertBefore(label, pageSizeSelect);
  }

  if (root.dataset.reportPageSizeInitialized !== "true") {
    root.dataset.reportPageSizeInitialized = "true";
    pageSizeSelect.value = "10";
    pageSizeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (!PAGE_SIZE_OPTIONS.includes(Number(pageSizeSelect.value))) {
    pageSizeSelect.value = "10";
  }
}

function findPaginationElements(root: HTMLElement) {
  const pageText = Array.from(root.querySelectorAll<HTMLElement>("span")).find(
    (element) => /^Page\s+\d+\s*\/\s*\d+$/.test(element.textContent?.trim() || "")
  );
  if (!pageText?.parentElement) return null;

  const match = pageText.textContent
    ?.trim()
    .match(/^Page\s+(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const controls = pageText.parentElement;
  const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>("button"));
  const previousButton = buttons.find(
    (button) => button.textContent?.trim() === "Previous"
  );
  const nextButton = buttons.find(
    (button) => button.textContent?.trim() === "Next"
  );

  if (!previousButton || !nextButton) return null;

  return {
    controls,
    pageText,
    previousButton,
    nextButton,
    currentPage: Number(match[1]),
    totalPages: Math.max(1, Number(match[2])),
  };
}

function waitForNextRender() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

async function navigateToPage(root: HTMLElement, targetPage: number) {
  if (root.dataset.reportPageMoving === "true") return;
  root.dataset.reportPageMoving = "true";

  try {
    let attempts = 0;
    while (attempts < 200) {
      attempts += 1;
      const state = findPaginationElements(root);
      if (!state) return;

      const safeTarget = Math.min(
        Math.max(1, targetPage),
        state.totalPages
      );
      if (state.currentPage === safeTarget) return;

      const button =
        safeTarget > state.currentPage
          ? state.nextButton
          : state.previousButton;
      if (button.disabled) return;

      button.click();
      await waitForNextRender();
    }
  } finally {
    delete root.dataset.reportPageMoving;
  }
}

function createPageButton(
  label: string,
  active: boolean,
  disabled: boolean,
  onClick: () => void
) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.className = active
    ? "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm"
    : "inline-flex h-9 min-w-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40";
  button.addEventListener("click", onClick);
  return button;
}

function enhanceNumberedPagination(root: HTMLElement) {
  const state = findPaginationElements(root);
  if (!state) return;

  state.previousButton.style.display = "none";
  state.nextButton.style.display = "none";
  state.pageText.style.display = "none";

  let pagination = state.controls.querySelector<HTMLElement>(
    "[data-report-numbered-pagination]"
  );
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.dataset.reportNumberedPagination = "true";
    pagination.className =
      "flex flex-wrap items-center justify-center gap-1.5 sm:justify-end";
    state.controls.appendChild(pagination);
  }

  const windowSize = Math.min(PAGE_WINDOW_SIZE, state.totalPages);
  const maxStart = Math.max(1, state.totalPages - windowSize + 1);
  const startPage = Math.min(Math.max(1, state.currentPage), maxStart);
  const endPage = Math.min(
    state.totalPages,
    startPage + windowSize - 1
  );
  const signature = `${state.currentPage}:${state.totalPages}:${startPage}:${endPage}`;

  if (pagination.dataset.paginationSignature === signature) return;
  pagination.dataset.paginationSignature = signature;
  pagination.replaceChildren();

  pagination.appendChild(
    createPageButton(
      "<",
      false,
      state.currentPage <= 1,
      () => void navigateToPage(root, state.currentPage - 1)
    )
  );

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    pagination.appendChild(
      createPageButton(
        String(pageNumber),
        pageNumber === state.currentPage,
        false,
        () => void navigateToPage(root, pageNumber)
      )
    );
  }

  pagination.appendChild(
    createPageButton(
      ">",
      false,
      state.currentPage >= state.totalPages,
      () => void navigateToPage(root, state.currentPage + 1)
    )
  );

  const ofLabel = document.createElement("span");
  ofLabel.className = "ml-1 text-sm text-muted-foreground";
  ofLabel.textContent = "of";
  pagination.appendChild(ofLabel);

  const totalBox = document.createElement("span");
  totalBox.className =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border bg-muted px-3 text-sm font-semibold tabular-nums";
  totalBox.textContent = String(state.totalPages);
  totalBox.title = `Total ${state.totalPages} halaman`;
  pagination.appendChild(totalBox);
}

function enhanceReport(root: HTMLElement) {
  enhanceReportTableScroll(root);
  enhancePageSizeSelector(root);
  enhanceNumberedPagination(root);
}

export default function ParsingReportPageV4() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const scheduleEnhancement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => enhanceReport(root));
    };

    scheduleEnhancement();

    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
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

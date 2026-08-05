import { ReactNode, useEffect, useRef } from "react";

const PAGE_WINDOW_SIZE = 5;

type PaginationState = {
  controls: HTMLElement;
  pageText: HTMLElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  currentPage: number;
  totalPages: number;
};

type NumberedPaginationEnhancerProps = {
  children: ReactNode;
  enhanceReportScroll?: boolean;
};

function findPaginationState(root: HTMLElement): PaginationState | null {
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

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value"
  )?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function enhancePageSize(root: HTMLElement) {
  const select = findPageSizeSelect(root);
  if (!select) return;

  if (!Array.from(select.options).some((option) => option.value === "10")) {
    const option = document.createElement("option");
    option.value = "10";
    option.textContent = "10";
    select.insertBefore(option, select.firstChild);
  }

  select.hidden = false;
  select.tabIndex = 0;
  select.removeAttribute("aria-hidden");

  if (root.dataset.pageSizeInitialized !== "true") {
    root.dataset.pageSizeInitialized = "true";
    setNativeSelectValue(select, "10");
  }
}

function waitForPageChange(
  root: HTMLElement,
  previousPage: number,
  timeoutMs = 10000
) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let observer: MutationObserver;
    let timeout = 0;

    const finish = (changed: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve(changed);
    };

    observer = new MutationObserver(() => {
      const state = findPaginationState(root);
      if (state && state.currentPage !== previousPage) finish(true);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    timeout = window.setTimeout(() => finish(false), timeoutMs);
  });
}

async function moveToPage(root: HTMLElement, requestedPage: number) {
  if (root.dataset.paginationMoving === "true") return;
  root.dataset.paginationMoving = "true";

  try {
    for (let step = 0; step < 50; step += 1) {
      const state = findPaginationState(root);
      if (!state) return;

      const targetPage = Math.min(
        Math.max(1, requestedPage),
        state.totalPages
      );
      if (state.currentPage === targetPage) return;

      const forward = targetPage > state.currentPage;
      const button = forward ? state.nextButton : state.previousButton;
      if (button.disabled) return;

      const previousPage = state.currentPage;
      const pageChange = waitForPageChange(root, previousPage);
      button.click();
      const changed = await pageChange;
      if (!changed) return;
    }
  } finally {
    delete root.dataset.paginationMoving;
  }
}

function createButton(
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

function getWindowStart(
  root: HTMLElement,
  state: PaginationState,
  windowSize: number
) {
  const maxStart = Math.max(1, state.totalPages - windowSize + 1);
  const storedStart = Number(root.dataset.paginationWindowStart || "1");
  const previousPage = Number(root.dataset.paginationWindowPage || "0");

  let startPage = Number.isFinite(storedStart) ? storedStart : 1;
  startPage = Math.min(Math.max(1, startPage), maxStart);

  if (previousPage !== state.currentPage) {
    const endPage = Math.min(
      state.totalPages,
      startPage + windowSize - 1
    );

    if (state.currentPage > endPage) {
      startPage = Math.min(
        state.currentPage - windowSize + 1,
        maxStart
      );
    } else if (state.currentPage < startPage) {
      startPage = Math.max(1, state.currentPage);
    } else if (
      state.currentPage === endPage &&
      state.currentPage < state.totalPages
    ) {
      startPage = Math.min(startPage + 1, maxStart);
    } else if (state.currentPage === startPage && state.currentPage > 1) {
      startPage = Math.max(1, startPage - 1);
    }

    root.dataset.paginationWindowPage = String(state.currentPage);
  }

  startPage = Math.min(Math.max(1, startPage), maxStart);
  root.dataset.paginationWindowStart = String(startPage);
  return startPage;
}

function enhancePagination(root: HTMLElement) {
  const state = findPaginationState(root);
  if (!state) return;

  state.previousButton.style.display = "none";
  state.nextButton.style.display = "none";
  state.pageText.style.display = "none";

  let pagination = state.controls.querySelector<HTMLElement>(
    "[data-numbered-pagination]"
  );
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.dataset.numberedPagination = "true";
    pagination.className =
      "flex flex-wrap items-center justify-center gap-1.5 sm:justify-end";
    state.controls.appendChild(pagination);
  }

  const windowSize = Math.min(PAGE_WINDOW_SIZE, state.totalPages);
  const startPage = getWindowStart(root, state, windowSize);
  const endPage = Math.min(state.totalPages, startPage + windowSize - 1);
  const signature = `${state.currentPage}:${state.totalPages}:${startPage}:${endPage}`;
  if (pagination.dataset.signature === signature) return;

  pagination.dataset.signature = signature;
  pagination.replaceChildren();

  pagination.appendChild(
    createButton("<", false, state.currentPage <= 1, () => {
      void moveToPage(root, state.currentPage - 1);
    })
  );

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    pagination.appendChild(
      createButton(
        String(pageNumber),
        pageNumber === state.currentPage,
        false,
        () => void moveToPage(root, pageNumber)
      )
    );
  }

  pagination.appendChild(
    createButton(">", false, state.currentPage >= state.totalPages, () => {
      void moveToPage(root, state.currentPage + 1);
    })
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

function enhanceReportTableScroll(root: HTMLElement) {
  const table = Array.from(root.querySelectorAll<HTMLTableElement>("table")).find(
    (item) =>
      item.classList.contains("min-w-[1550px]") ||
      item.classList.contains("min-w-[1350px]")
  );
  const container = table?.parentElement;
  if (!container) return;

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

export function NumberedPaginationEnhancer({
  children,
  enhanceReportScroll = false,
}: NumberedPaginationEnhancerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const enhance = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        enhancePageSize(root);
        enhancePagination(root);
        if (enhanceReportScroll) enhanceReportTableScroll(root);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("resize", enhance);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", enhance);
    };
  }, [enhanceReportScroll]);

  return (
    <div ref={rootRef} className="min-w-0">
      {children}
    </div>
  );
}

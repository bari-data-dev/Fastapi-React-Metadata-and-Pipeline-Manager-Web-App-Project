import { useEffect } from "react";

const ODIST_OLD_HELP_TEXT =
  "Geser batas kanan header untuk resize kolom. Double-click untuk reset.";
const ODIST_NEW_HELP_TEXT =
  "CTRL + R untuk reset filter | CTRL + S untuk save perubahan";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function isVisible(element: HTMLElement | null) {
  if (!element || element.hidden || element.getClientRects().length === 0) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function findVisibleButtonByText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => isVisible(button) && normalizedText(button) === text
    ) || null
  );
}

function findFieldListButton(): HTMLButtonElement | null {
  return findVisibleButtonByText("Field List");
}

function findFieldListPanel(): HTMLElement | null {
  const title = Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3, h4")
  ).find(
    (element) =>
      isVisible(element) && normalizedText(element) === "PILIH KOLOM"
  );
  if (!title) return null;

  let current: HTMLElement | null = title.parentElement;
  while (current && current !== document.body) {
    if (
      isVisible(current) &&
      current.querySelector('input[placeholder="Cari nama field..."]')
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isValueFilterModalOpen() {
  return Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3, h4")
  ).some(
    (element) =>
      isVisible(element) &&
      normalizedText(element).startsWith("FILTER BY VALUE:")
  );
}

function findBatchActionButton(): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button")
  ).filter((button) => isVisible(button));

  const confirmButton = buttons.find((button) => {
    const text = normalizedText(button);
    return !button.disabled && (/^Save \d+ Rows$/.test(text) || text === "Saving...");
  });
  if (confirmButton) return confirmButton;

  return (
    buttons.find((button) => {
      const text = normalizedText(button);
      return (
        !button.disabled &&
        (text.startsWith("Save All") || text.startsWith("Save Changes"))
      );
    }) || null
  );
}

function setControlValue(
  control: HTMLInputElement | HTMLSelectElement,
  value: string
) {
  const prototype =
    control instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (setter) setter.call(control, value);
  else control.value = value;

  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function findActiveReportRoot(): HTMLElement | null {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
    (element) =>
      isVisible(element) && normalizedText(element) === "PARSING REPORT"
  );
  if (!title) return null;

  let current: HTMLElement | null = title.parentElement;
  while (current && current !== document.body) {
    const hasDateFilter = Boolean(current.querySelector('input[type="date"]'));
    const hasResetButton = Array.from(
      current.querySelectorAll<HTMLButtonElement>("button")
    ).some((button) => isVisible(button) && normalizedText(button) === "Reset");

    if (hasDateFilter && hasResetButton) return current;
    current = current.parentElement;
  }

  return null;
}

function resetReportFilters() {
  const root = findActiveReportRoot();
  if (!root) return false;

  const resetButton = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) => isVisible(button) && normalizedText(button) === "Reset");
  resetButton?.click();

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dateInputs = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="date"]')
  ).filter((input) => isVisible(input));
  if (dateInputs[0]) setControlValue(dateInputs[0], formatDate(firstDay));
  if (dateInputs[1]) setControlValue(dateInputs[1], formatDate(now));

  const memberLabel = Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find(
    (label) =>
      isVisible(label) &&
      normalizedText(label.querySelector("span")) === "ANGGOTA"
  );
  const memberSelect = memberLabel?.querySelector<HTMLSelectElement>("select");
  if (memberSelect) setControlValue(memberSelect, "");

  return true;
}

function resetFiltersForActivePage() {
  const pathname = window.location.pathname;

  if (
    pathname === "/metadata/odists-parsing" ||
    pathname === "/metadata/produk-distributor"
  ) {
    findVisibleButtonByText("Reset Filter")?.click();
    return true;
  }

  if (pathname === "/reports/parsing") {
    return resetReportFilters();
  }

  return false;
}

function replaceOdistHelpText() {
  if (window.location.pathname !== "/metadata/odists-parsing") return;

  Array.from(document.querySelectorAll<HTMLElement>("span")).forEach(
    (element) => {
      if (normalizedText(element) === ODIST_OLD_HELP_TEXT) {
        element.textContent = ODIST_NEW_HELP_TEXT;
      }
    }
  );
}

function isMainOdistTableContainer(element: HTMLElement) {
  const className = element.className;
  return (
    typeof className === "string" &&
    (className.includes("max-h-[62dvh]") ||
      className.includes("sm:max-h-[68vh]"))
  );
}

function findScrollableTableContainer(
  start: EventTarget | null
): HTMLElement | null {
  let current = start instanceof HTMLElement ? start : null;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const scrollableY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight + 1;
    const ownsTable = Array.from(current.children).some(
      (child) => child.tagName === "TABLE"
    );

    if (scrollableY && ownsTable && isMainOdistTableContainer(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

export function InteractionEnhancements() {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const panel = findFieldListPanel();
      if (!panel) return;

      const button = findFieldListButton();
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (!panel.contains(target) && !button?.contains(target)) {
        button?.click();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const hasCommandModifier = event.ctrlKey || event.metaKey;
      if (!hasCommandModifier) return;

      const key = event.key.toLowerCase();

      if (key === "r" && resetFiltersForActivePage()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      if (key !== "s") return;
      const pathname = window.location.pathname;
      if (
        pathname !== "/metadata/odists-parsing" &&
        pathname !== "/metadata/produk-distributor"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isValueFilterModalOpen()) return;
      findBatchActionButton()?.click();
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      const container = findScrollableTableContainer(event.target);
      if (!container) return;

      const maxScrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight
      );
      if (maxScrollTop <= 0) return;

      const currentScrollTop = container.scrollTop;
      const requestedScrollTop = currentScrollTop + event.deltaY;

      if (event.deltaY > 0 && requestedScrollTop > maxScrollTop) {
        event.preventDefault();
        event.stopPropagation();

        const pageDelta = requestedScrollTop - maxScrollTop;
        container.scrollTop = maxScrollTop;
        window.scrollBy({ top: pageDelta, left: 0, behavior: "auto" });
        return;
      }

      if (event.deltaY < 0 && requestedScrollTop < 0) {
        event.preventDefault();
        event.stopPropagation();

        const pageDelta = requestedScrollTop;
        container.scrollTop = 0;
        window.scrollBy({ top: pageDelta, left: 0, behavior: "auto" });
        return;
      }

      event.stopPropagation();
    };

    replaceOdistHelpText();
    const textObserver = new MutationObserver(replaceOdistHelpText);
    textObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      textObserver.disconnect();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("wheel", handleWheel, true);
    };
  }, []);

  return null;
}

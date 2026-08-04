import { useEffect } from "react";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function findFieldListButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => normalizedText(button) === "Field List"
    ) || null
  );
}

function findFieldListPanel(): HTMLElement | null {
  const title = Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3, h4")
  ).find((element) => normalizedText(element) === "PILIH KOLOM");
  if (!title) return null;

  let current: HTMLElement | null = title.parentElement;
  while (current && current !== document.body) {
    if (current.querySelector('input[placeholder="Cari nama field..."]')) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isValueFilterModalOpen() {
  return Array.from(
    document.querySelectorAll<HTMLElement>("h1, h2, h3, h4")
  ).some((element) => normalizedText(element).startsWith("FILTER BY VALUE:"));
}

function findOdistBatchActionButton(): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button")
  );

  const confirmButton = buttons.find((button) => {
    const text = normalizedText(button);
    return !button.disabled && (/^Save \d+ Rows$/.test(text) || text === "Saving...");
  });
  if (confirmButton) return confirmButton;

  return (
    buttons.find((button) => {
      const text = normalizedText(button);
      return !button.disabled && text.startsWith("Save All");
    }) || null
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
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      if (!isSaveShortcut) return;
      if (window.location.pathname !== "/metadata/odists-parsing") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isValueFilterModalOpen()) return;
      findOdistBatchActionButton()?.click();
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

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("wheel", handleWheel, true);
    };
  }, []);

  return null;
}

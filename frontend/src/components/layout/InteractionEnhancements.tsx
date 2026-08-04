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
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4")).find(
    (element) => normalizedText(element) === "PILIH KOLOM"
  );
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

function findScrollableTableContainer(start: EventTarget | null): HTMLElement | null {
  let current = start instanceof HTMLElement ? start : null;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const scrollableY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight + 1;
    const ownsTable = Array.from(current.children).some(
      (child) => child.tagName === "TABLE"
    );

    if (scrollableY && ownsTable) return current;
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

      // Selama tabel masih dapat bergerak, wheel hanya menggerakkan tabel.
      // Ini mencegah halaman ikut tersentak sebelum batas tabel tercapai.
      event.stopPropagation();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("wheel", handleWheel, true);
    };
  }, []);

  return null;
}

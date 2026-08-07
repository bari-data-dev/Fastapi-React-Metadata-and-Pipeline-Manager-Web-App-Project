import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const PAGE_WINDOW_SIZE = 5;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  loading?: boolean;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function TablePagination({
  page,
  pageSize,
  totalPages,
  totalRows,
  loading = false,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const [windowStart, setWindowStart] = useState(1);
  const previousPageRef = useRef(safePage);

  useEffect(() => {
    const windowSize = Math.min(PAGE_WINDOW_SIZE, safeTotalPages);
    const maxStart = Math.max(1, safeTotalPages - windowSize + 1);

    setWindowStart((currentStart) => {
      let nextStart = Math.min(Math.max(1, currentStart), maxStart);
      const endPage = Math.min(
        safeTotalPages,
        nextStart + windowSize - 1
      );
      const previousPage = previousPageRef.current;

      if (previousPage !== safePage) {
        if (safePage > endPage) {
          nextStart = Math.min(safePage - windowSize + 1, maxStart);
        } else if (safePage < nextStart) {
          nextStart = Math.max(1, safePage);
        } else if (safePage === endPage && safePage < safeTotalPages) {
          nextStart = Math.min(nextStart + 1, maxStart);
        } else if (safePage === nextStart && safePage > 1) {
          nextStart = Math.max(1, nextStart - 1);
        }
      }

      return Math.min(Math.max(1, nextStart), maxStart);
    });

    previousPageRef.current = safePage;
  }, [safePage, safeTotalPages]);

  const windowSize = Math.min(PAGE_WINDOW_SIZE, safeTotalPages);
  const maxStart = Math.max(1, safeTotalPages - windowSize + 1);
  const startPage = Math.min(Math.max(1, windowStart), maxStart);
  const endPage = Math.min(
    safeTotalPages,
    startPage + windowSize - 1
  );
  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index
  );

  const changePage = (nextPage: number) => {
    const target = Math.min(Math.max(1, nextPage), safeTotalPages);
    if (target === safePage || loading) return;
    onPageChange(target);
  };

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        <span>Total {totalRows} row</span>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows</span>
          <select
            className="h-9 rounded-md border bg-background px-2"
            value={pageSize}
            disabled={loading}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {loading && (
          <span className="text-xs text-muted-foreground">Memuat...</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-w-9 px-3"
          disabled={safePage <= 1 || loading}
          onClick={() => changePage(safePage - 1)}
          aria-label="Halaman sebelumnya"
        >
          &lt;
        </Button>

        {pageNumbers.map((pageNumber) => (
          <Button
            key={pageNumber}
            type="button"
            variant={pageNumber === safePage ? "default" : "outline"}
            size="sm"
            className="h-9 min-w-9 px-3 tabular-nums"
            disabled={loading && pageNumber !== safePage}
            onClick={() => changePage(pageNumber)}
            aria-current={pageNumber === safePage ? "page" : undefined}
          >
            {pageNumber}
          </Button>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-w-9 px-3"
          disabled={safePage >= safeTotalPages || loading}
          onClick={() => changePage(safePage + 1)}
          aria-label="Halaman berikutnya"
        >
          &gt;
        </Button>

        <span className="ml-1 text-sm text-muted-foreground">of</span>
        <span
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border bg-muted px-3 text-sm font-semibold tabular-nums"
          title={`Total ${safeTotalPages} halaman`}
        >
          {safeTotalPages}
        </span>
      </div>
    </div>
  );
}

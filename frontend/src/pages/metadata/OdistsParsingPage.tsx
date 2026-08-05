import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Filter } from "lucide-react";
import {
  DistinctValue,
  odistsApi,
  OdistsBatchUpdateItem,
  OdistsColumn,
  OdistsPage,
} from "@/lib/appApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const DEFAULT_COLUMNS = [
  "id",
  "ogal_id",
  "cust_name",
  "address",
  "city",
  "province",
  "kecamatan",
  "kelurahan",
];

const DATE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "parsed_at",
  "dwh_loaded_at",
  "dwh_refreshed_at",
]);

const DEFAULT_COLUMN_WIDTH = 210;
const ID_COLUMN_WIDTH = 230;
const MOBILE_COLUMN_WIDTH = 170;
const MOBILE_ID_COLUMN_WIDTH = 190;
const MIN_COLUMN_WIDTH = 110;
const MAX_COLUMN_WIDTH = 700;

type SelectedValue = string | number | null;

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function renderValue(field: string, value: unknown) {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">NULL</span>;
  }
  if (DATE_FIELDS.has(field)) return formatDate(value);
  return String(value);
}

function normalizedValue(value: unknown) {
  return value === "" ? null : value;
}

function valueKey(value: SelectedValue) {
  return value === null ? "__NULL__" : `${typeof value}:${String(value)}`;
}

function parseSelectedValues(filterValue: string | undefined): SelectedValue[] {
  if (!filterValue?.startsWith("__IN__:")) return [];
  try {
    const parsed = JSON.parse(filterValue.slice(7));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function OdistsParsingPage() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<OdistsPage | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [fieldSearch, setFieldSearch] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [draftRows, setDraftRows] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [valuePickerField, setValuePickerField] = useState<string | null>(null);
  const [valuePickerSearch, setValuePickerSearch] = useState("");
  const [valuePickerValues, setValuePickerValues] = useState<DistinctValue[]>([]);
  const [valuePickerLoading, setValuePickerLoading] = useState(false);
  const [selectedValues, setSelectedValues] = useState<SelectedValue[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await odistsApi.getPage({
        page,
        pageSize,
        columns: visibleColumns,
        filters: appliedFilters,
        sortBy,
        sortDir,
      });
      setData(response.data);
      setDraftRows({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [
    page,
    pageSize,
    visibleColumns.join(","),
    JSON.stringify(appliedFilters),
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    if (!valuePickerField) return;
    let cancelled = false;
    setValuePickerLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await odistsApi.getDistinctValues(
          valuePickerField,
          valuePickerSearch,
          200,
          appliedFilters
        );
        if (!cancelled) {
          setValuePickerValues(response.data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setValuePickerValues([]);
          setError(
            err instanceof Error ? err.message : "Gagal mengambil daftar nilai"
          );
        }
      } finally {
        if (!cancelled) setValuePickerLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    valuePickerField,
    valuePickerSearch,
    JSON.stringify(appliedFilters),
  ]);

  const metadata = data?.columns || [];
  const metadataMap = useMemo(
    () => new Map(metadata.map((column) => [column.name, column])),
    [metadata]
  );

  const displayColumnName = (name: string) =>
    (metadataMap.get(name)?.label || name).replace(/_/g, " ").toUpperCase();

  const filteredFields = metadata.filter((column) =>
    `${column.name} ${column.label}`
      .toLowerCase()
      .includes(fieldSearch.toLowerCase())
  );

  const activeFilterCount = Object.keys(appliedFilters).length;

  const getColumnWidth = (name: string) => {
    if (columnWidths[name]) return columnWidths[name];
    if (isMobile) {
      return name === "id" ? MOBILE_ID_COLUMN_WIDTH : MOBILE_COLUMN_WIDTH;
    }
    return name === "id" ? ID_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH;
  };

  const totalTableWidth = visibleColumns.reduce(
    (total, name) => total + getColumnWidth(name),
    0
  );

  const beginColumnResize = (
    event: ReactMouseEvent<HTMLDivElement>,
    name: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = getColumnWidth(name);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)
      );
      setColumnWidths((current) => ({ ...current, [name]: nextWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const resetColumnWidth = (name: string) => {
    setColumnWidths((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const toggleColumn = (name: string) => {
    setPage(1);
    setVisibleColumns((current) => {
      if (name === "id") return current;
      return current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
    });
  };

  const toggleSort = (name: string) => {
    setPage(1);
    if (sortBy === name) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(name);
      setSortDir("asc");
    }
  };

  const rowId = (row: Record<string, unknown>) => String(row.id);

  const getCellValue = (row: Record<string, unknown>, field: string) => {
    const draft = draftRows[rowId(row)];
    return draft && field in draft ? draft[field] : row[field];
  };

  const setCellValue = (
    row: Record<string, unknown>,
    field: string,
    value: unknown
  ) => {
    const id = rowId(row);
    setSuccessMessage("");
    setDraftRows((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), [field]: value },
    }));
  };

  const getChangedValues = (row: Record<string, unknown>) => {
    const draft = draftRows[rowId(row)] || {};
    const changed: Record<string, unknown> = {};

    Object.entries(draft).forEach(([field, value]) => {
      const nextValue = normalizedValue(value);
      const originalValue = normalizedValue(row[field]);
      if (String(nextValue ?? "") !== String(originalValue ?? "")) {
        changed[field] = nextValue;
      }
    });

    return changed;
  };

  const pendingUpdates: OdistsBatchUpdateItem[] = (data?.items || [])
    .map((row) => ({
      id: Number(row.id),
      values: getChangedValues(row),
    }))
    .filter((item) => Object.keys(item.values).length > 0);

  const dirtyRowCount = pendingUpdates.length;
  const totalChangedFields = pendingUpdates.reduce(
    (total, item) => total + Object.keys(item.values).length,
    0
  );

  const isRowDirty = (row: Record<string, unknown>) =>
    Object.keys(getChangedValues(row)).length > 0;

  const cancelRow = (row: Record<string, unknown>) => {
    const id = rowId(row);
    setDraftRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const discardAllChanges = () => {
    setDraftRows({});
    setBatchConfirmOpen(false);
    setSuccessMessage("");
  };

  const requestBatchSave = () => {
    if (!dirtyRowCount || batchSaving) return;
    setBatchConfirmOpen(true);
  };

  const saveAllChanges = async () => {
    if (!pendingUpdates.length || batchSaving) return;

    setBatchSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await odistsApi.updateBatch(pendingUpdates);
      setBatchConfirmOpen(false);
      await load();
      setSuccessMessage(
        `${response.data.updated_count} row ODIST berhasil diperbarui.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch update gagal");
    } finally {
      setBatchSaving(false);
    }
  };

  const handlePageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      if (batchConfirmOpen) {
        void saveAllChanges();
      } else if (!valuePickerField) {
        requestBatchSave();
      }
      return;
    }

    if (event.key === "Escape" && batchConfirmOpen && !batchSaving) {
      event.preventDefault();
      setBatchConfirmOpen(false);
    }
  };

  const openValuePicker = (field: string) => {
    setValuePickerValues([]);
    setValuePickerSearch("");
    setSelectedValues(parseSelectedValues(appliedFilters[field]));
    setValuePickerField(field);
  };

  const toggleSelectedValue = (value: SelectedValue) => {
    const key = valueKey(value);
    setSelectedValues((current) =>
      current.some((item) => valueKey(item) === key)
        ? current.filter((item) => valueKey(item) !== key)
        : [...current, value]
    );
  };

  const applySelectedValues = () => {
    if (!valuePickerField) return;
    const nextFilters = { ...appliedFilters };
    if (selectedValues.length) {
      nextFilters[valuePickerField] = `__IN__:${JSON.stringify(selectedValues)}`;
    } else {
      delete nextFilters[valuePickerField];
    }
    setAppliedFilters(nextFilters);
    setPage(1);
    setValuePickerField(null);
  };

  const resetSelectedValues = () => setSelectedValues([]);

  const renderEditableCell = (
    row: Record<string, unknown>,
    column: OdistsColumn
  ) => {
    const value = getCellValue(row, column.name);
    const changed =
      column.name in (draftRows[rowId(row)] || {}) &&
      String(normalizedValue(value) ?? "") !==
        String(normalizedValue(row[column.name]) ?? "");

    return (
      <td
        key={column.name}
        className={cn(
          "overflow-hidden border-b p-1 align-top",
          changed && "bg-amber-100 dark:bg-amber-950/40"
        )}
        style={{ width: getColumnWidth(column.name) }}
      >
        <Input
          className="h-9 w-full min-w-0 border-transparent bg-transparent px-2 text-xs hover:border-input focus:border-input sm:h-8 sm:text-sm"
          value={value == null ? "" : String(value)}
          onChange={(event) =>
            setCellValue(row, column.name, event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelRow(row);
          }}
        />
      </td>
    );
  };

  return (
    <div
      className="min-w-0 space-y-3 p-3 text-sm sm:space-y-4 sm:p-6"
      onKeyDownCapture={handlePageKeyDown}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">ODIST Parsing</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            <span className="sm:hidden">
              Edit beberapa data lalu gunakan Save All.
            </span>
            <span className="hidden sm:inline">
              Edit beberapa row, lalu tekan Ctrl + Enter untuk menyimpan seluruh
              perubahan sekaligus.
            </span>
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button
            className="w-full sm:w-auto"
            onClick={requestBatchSave}
            disabled={!dirtyRowCount || batchSaving}
          >
            <span className="sm:hidden">Save All</span>
            <span className="hidden sm:inline">Save All Changes</span>
            {dirtyRowCount ? ` (${dirtyRowCount})` : ""}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={discardAllChanges}
            disabled={!dirtyRowCount || batchSaving}
          >
            Discard All
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setShowFields((value) => !value)}
          >
            Field List
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void load()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {dirtyRowCount > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <span className="font-medium">
            {dirtyRowCount} row dan {totalChangedFields} field belum disimpan.
          </span>
          <span className="hidden text-xs sm:inline">Shortcut: Ctrl + Enter</span>
        </div>
      )}

      {showFields && (
        <Card>
          <CardHeader className="px-4 py-4 sm:px-6 sm:py-5">
            <CardTitle className="text-base">PILIH KOLOM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
            <Input
              placeholder="Cari nama field..."
              value={fieldSearch}
              onChange={(event) => setFieldSearch(event.target.value)}
            />
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {filteredFields.map((column) => (
                <label
                  key={column.name}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    checked={visibleColumns.includes(column.name)}
                    disabled={column.name === "id"}
                    onChange={() => toggleColumn(column.name)}
                  />
                  <span className="truncate">
                    {displayColumnName(column.name)}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="space-y-3 p-3 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!activeFilterCount}
              onClick={() => {
                setAppliedFilters({});
                setPage(1);
              }}
            >
              Reset Filter
            </Button>

            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-xs text-muted-foreground sm:text-sm">
                {activeFilterCount
                  ? `${activeFilterCount} filter aktif`
                  : "Tidak ada filter aktif"}
              </span>
              <span className="text-xs text-muted-foreground sm:hidden">
                Geser tabel ke samping untuk melihat kolom lain.
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Geser batas kanan header untuk resize kolom. Double-click untuk
                reset.
              </span>
            </div>

            <label className="flex w-full items-center justify-between text-sm sm:ml-auto sm:w-auto sm:justify-start">
              <span>Rows</span>
              <select
                className="ml-2 min-w-24 rounded border bg-background px-2 py-2"
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
              >
                {[25, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {successMessage && (
            <p className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              {successMessage}
            </p>
          )}

          <div className="max-h-[62dvh] w-full touch-auto overflow-auto overscroll-contain rounded-md border sm:max-h-[68vh]">
            <table
              className="border-collapse text-xs sm:text-sm"
              style={{ tableLayout: "fixed", width: totalTableWidth }}
            >
              <colgroup>
                {visibleColumns.map((name) => (
                  <col key={name} style={{ width: getColumnWidth(name) }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20 bg-background shadow-sm">
                <tr>
                  {visibleColumns.map((name) => {
                    const chosenCount = parseSelectedValues(
                      appliedFilters[name]
                    ).length;
                    const label = displayColumnName(name);
                    return (
                      <th
                        key={name}
                        className={cn(
                          "relative overflow-visible border-b p-2 text-left align-middle",
                          name === "id" &&
                            "sticky left-0 z-30 bg-background shadow-[1px_0_0_0_hsl(var(--border))]"
                        )}
                        style={{ width: getColumnWidth(name) }}
                      >
                        <div className="flex min-w-0 items-center gap-1 pr-1">
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold tracking-wide sm:text-xs"
                            title={`Sort by ${label}`}
                            onClick={() => toggleSort(name)}
                          >
                            {label}
                            {sortBy === name
                              ? sortDir === "asc"
                                ? " ▲"
                                : " ▼"
                              : ""}
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant={chosenCount ? "default" : "outline"}
                            className="h-8 w-8 shrink-0 gap-0 p-0 sm:h-7 sm:w-auto sm:gap-1 sm:px-2"
                            title={`Filter ${label} by value`}
                            onClick={() => openValuePicker(name)}
                          >
                            <Filter className="h-3.5 w-3.5" />
                            {chosenCount > 0 && (
                              <span className="ml-0.5 text-[9px] font-bold sm:text-[10px]">
                                {chosenCount}
                              </span>
                            )}
                          </Button>
                        </div>
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          title="Drag untuk resize. Double-click untuk reset."
                          className="absolute right-0 top-0 z-20 hidden h-full w-2 translate-x-1/2 cursor-col-resize select-none hover:bg-primary/30 sm:block"
                          onMouseDown={(event) =>
                            beginColumnResize(event, name)
                          }
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            resetColumnWidth(name);
                          }}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      className="p-6 text-center"
                      colSpan={visibleColumns.length}
                    >
                      Memuat data...
                    </td>
                  </tr>
                ) : data?.items.length ? (
                  data.items.map((row) => {
                    const dirty = isRowDirty(row);
                    return (
                      <tr
                        key={rowId(row)}
                        className={
                          dirty
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : "hover:bg-muted/40"
                        }
                      >
                        {visibleColumns.map((name) => {
                          const column = metadataMap.get(name);
                          if (column?.editable) {
                            return renderEditableCell(row, column);
                          }

                          const title =
                            row[name] == null ? "NULL" : String(row[name]);
                          return (
                            <td
                              key={name}
                              className={cn(
                                "overflow-hidden border-b p-2 align-top",
                                name === "id" &&
                                  "sticky left-0 z-10 bg-background shadow-[1px_0_0_0_hsl(var(--border))]",
                                name === "id" &&
                                  dirty &&
                                  "bg-amber-50 dark:bg-amber-950"
                              )}
                              style={{ width: getColumnWidth(name) }}
                            >
                              <div
                                className="truncate whitespace-nowrap"
                                title={title}
                              >
                                {renderValue(name, row[name])}
                              </div>
                              {name === "id" && dirty && (
                                <div className="mt-2 flex flex-col items-start gap-1.5 overflow-hidden sm:flex-row sm:items-center sm:gap-2">
                                  <span className="shrink-0 rounded-full bg-amber-200 px-2 py-1 text-[10px] font-medium text-amber-950 dark:bg-amber-900 dark:text-amber-100 sm:text-xs">
                                    Changed
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 shrink-0 px-2 text-[10px] sm:text-xs"
                                    onClick={() => cancelRow(row)}
                                    disabled={batchSaving}
                                  >
                                    Cancel Row
                                  </Button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      className="p-6 text-center"
                      colSpan={visibleColumns.length}
                    >
                      Tidak ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-center sm:text-left">
              Total {data?.total ?? 0} row
            </span>
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <span className="whitespace-nowrap text-center text-xs sm:text-sm">
                Page {data?.page ?? page} / {data?.total_pages ?? 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={page >= (data?.total_pages ?? 1)}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {batchConfirmOpen && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/50 p-0 sm:p-6">
          <div className="flex min-h-full items-start justify-center sm:items-center sm:py-4">
            <Card className="flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none border-0 bg-background shadow-2xl sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:rounded-xl sm:border">
              <CardHeader className="shrink-0 border-b bg-background px-4 py-4 sm:px-6 sm:pb-4 sm:pt-6">
                <CardTitle className="text-lg leading-7 sm:text-xl">
                  Confirm Batch Update
                </CardTitle>
                <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                  Periksa ringkasan perubahan sebelum data disimpan ke database.
                </p>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-0 text-sm">
                <div className="grid shrink-0 grid-cols-2 gap-2 border-b bg-muted/20 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
                  <div className="rounded-lg border bg-background p-3 sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                      Rows
                    </p>
                    <p className="mt-1 text-xl font-bold sm:text-2xl">
                      {dirtyRowCount}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-3 sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                      Changed fields
                    </p>
                    <p className="mt-1 text-xl font-bold sm:text-2xl">
                      {totalChangedFields}
                    </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-6 sm:py-4">
                  <div className="overflow-auto rounded-lg border">
                    <table className="min-w-[480px] w-full text-xs sm:text-sm">
                      <thead className="sticky top-0 z-10 bg-background shadow-sm">
                        <tr>
                          <th className="w-32 border-b p-3 text-left font-semibold sm:w-40">
                            ODISTS ID
                          </th>
                          <th className="border-b p-3 text-left font-semibold">
                            FIELDS TO UPDATE
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingUpdates.map((item) => (
                          <tr key={item.id}>
                            <td className="border-b p-3 font-medium tabular-nums">
                              {item.id}
                            </td>
                            <td className="border-b p-3 leading-5 text-muted-foreground sm:leading-6">
                              {Object.keys(item.values)
                                .map((field) =>
                                  field.replace(/_/g, " ").toUpperCase()
                                )
                                .join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Ctrl + Enter juga dapat digunakan untuk konfirmasi.
                  </span>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setBatchConfirmOpen(false)}
                      disabled={batchSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      autoFocus
                      className="w-full sm:w-auto"
                      onClick={() => void saveAllChanges()}
                      disabled={batchSaving}
                    >
                      {batchSaving
                        ? "Saving..."
                        : `Save ${dirtyRowCount} Rows`}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {valuePickerField && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-0 sm:p-6">
          <div className="flex min-h-full items-start justify-center sm:items-center sm:py-4">
            <Card className="flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none border-0 bg-background shadow-2xl sm:h-[min(760px,calc(100vh-3rem))] sm:max-h-[calc(100vh-3rem)] sm:rounded-xl sm:border">
              <CardHeader className="shrink-0 border-b bg-background px-4 py-4 sm:px-6 sm:pb-4 sm:pt-6">
                <CardTitle className="break-words text-base leading-6 sm:text-xl sm:leading-7">
                  FILTER BY VALUE: {displayColumnName(valuePickerField)}
                </CardTitle>
                <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                  Daftar value mengikuti filter aktif pada kolom lain, seperti
                  filter Excel.
                </p>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-0 text-sm">
                <div className="shrink-0 space-y-3 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
                  <Input
                    autoFocus
                    className="h-10 text-sm sm:h-11"
                    placeholder="Cari value..."
                    value={valuePickerSearch}
                    onChange={(event) =>
                      setValuePickerSearch(event.target.value)
                    }
                  />

                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                    <span className="text-xs font-medium sm:text-sm">
                      {selectedValues.length} value dipilih
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={resetSelectedValues}
                    >
                      Reset pilihan
                    </Button>
                  </div>

                  {selectedValues.length > 0 && (
                    <div className="flex max-h-24 flex-wrap gap-2 overflow-auto rounded-lg border bg-background p-2 sm:p-3">
                      {selectedValues.map((value) => (
                        <button
                          key={valueKey(value)}
                          type="button"
                          onClick={() => toggleSelectedValue(value)}
                          className="max-w-full truncate rounded-full border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70"
                          title={value === null ? "NULL" : String(value)}
                        >
                          {value === null ? "NULL" : String(value)} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mx-3 my-3 min-h-0 flex-1 overflow-auto rounded-lg border sm:mx-6 sm:my-4">
                  {valuePickerLoading ? (
                    <div className="p-6 text-center text-muted-foreground">
                      Memuat value terkait...
                    </div>
                  ) : (
                    <table className="w-full table-fixed text-xs sm:text-sm">
                      <thead className="sticky top-0 z-10 bg-background shadow-sm">
                        <tr>
                          <th className="w-10 border-b p-2 sm:w-12 sm:p-3"></th>
                          <th className="border-b p-2 text-left font-semibold sm:p-3">
                            VALUE
                          </th>
                          <th className="w-20 border-b p-2 text-right font-semibold sm:w-28 sm:p-3">
                            ROWS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {valuePickerValues.length ? (
                          valuePickerValues.map((item, index) => {
                            const checked = selectedValues.some(
                              (value) =>
                                valueKey(value) ===
                                valueKey(item.value as SelectedValue)
                            );
                            return (
                              <tr
                                key={`${valueKey(
                                  item.value as SelectedValue
                                )}-${index}`}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() =>
                                  toggleSelectedValue(
                                    item.value as SelectedValue
                                  )
                                }
                              >
                                <td className="border-b p-2 text-center sm:p-3">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={checked}
                                    readOnly
                                  />
                                </td>
                                <td
                                  className="break-words border-b p-2 leading-5 sm:p-3 sm:leading-6"
                                  title={
                                    item.value === null
                                      ? "NULL"
                                      : String(item.value)
                                  }
                                >
                                  {item.value === null ? (
                                    <span className="italic text-muted-foreground">
                                      NULL
                                    </span>
                                  ) : (
                                    String(item.value)
                                  )}
                                </td>
                                <td className="border-b p-2 text-right tabular-nums sm:p-3">
                                  {item.row_count}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              className="p-6 text-center text-muted-foreground"
                              colSpan={3}
                            >
                              Value terkait tidak ditemukan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-4 py-4 sm:flex-row sm:justify-between sm:gap-3 sm:px-6">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={resetSelectedValues}
                  >
                    Reset
                  </Button>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setValuePickerField(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={applySelectedValues}
                    >
                      OK
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
import {
  DistinctValue,
  ProdukDistributorBatchUpdateItem,
  ProdukDistributorColumn,
  ProdukDistributorCreateInput,
  ProdukDistributorPage as ProdukDistributorPageData,
  ProdukDistributorRecord,
  produkDistributorApi,
} from "@/lib/appApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/table/TablePagination";
import { cn } from "@/lib/utils";


type SelectedValue = string | number | null;
type DraftValues = Record<string, unknown>;
type InsertDraft = {
  localId: string;
  values: Record<string, string>;
};

const DISPLAY_COLUMN_ORDER = [
  "id",
  "Kode_Dist",
  "temp",
  "Kode_Produk_Dist",
  "Kode_Produk_GPL",
  "Nama_Produk_GPL",
  "Nama_Produk_Dist",
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  id: 100,
  Kode_Dist: 140,
  temp: 240,
  Kode_Produk_Dist: 220,
  Kode_Produk_GPL: 170,
  Nama_Produk_GPL: 330,
  Nama_Produk_Dist: 330,
};

const MIN_COLUMN_WIDTH = 100;
const MAX_COLUMN_WIDTH = 700;
const ACTION_WIDTH = 64;

const EMPTY_INSERT: Record<string, string> = {
  Kode_Dist: "",
  temp: "",
  Kode_Produk_Dist: "",
  Kode_Produk_GPL: "",
  Nama_Produk_GPL: "",
  Nama_Produk_Dist: "",
};

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

function normalizedValue(value: unknown) {
  return value === "" ? null : value;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">NULL</span>;
  }
  return String(value);
}

function displayColumnLabel(
  column: ProdukDistributorColumn | undefined,
  field: string
) {
  if (field === "temp") return "NAME DIST";
  return column?.label || field.replace(/_/g, " ").toUpperCase();
}

function insertPayload(values: Record<string, string>): ProdukDistributorCreateInput {
  const optionalString = (value: string) => (value === "" ? null : value);

  return {
    Kode_Dist: values.Kode_Dist,
    Kode_Produk_Dist: values.Kode_Produk_Dist,
    Kode_Produk_GPL: optionalString(values.Kode_Produk_GPL),
    Konversi_Unit: null,
    Nama_Produk_GPL: optionalString(values.Nama_Produk_GPL),
    Nama_Produk_Dist: optionalString(values.Nama_Produk_Dist),
    Produk_Paket: null,
    temp: optionalString(values.temp),
  };
}

function makeInsertDraft(): InsertDraft {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    values: { ...EMPTY_INSERT },
  };
}

export default function ProdukDistributorPage() {
  const [data, setData] = useState<ProdukDistributorPageData | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [draftRows, setDraftRows] = useState<Record<string, DraftValues>>({});
  const [insertRows, setInsertRows] = useState<InsertDraft[]>([]);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<ProdukDistributorRecord | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

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
      const response = await produkDistributorApi.getPage({
        page,
        pageSize,
        filters: appliedFilters,
        sortBy,
        sortDir,
      });
      setData(response.data);
      if (response.data.page !== page) setPage(response.data.page);
      setDraftRows({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil Produk Distributor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, pageSize, JSON.stringify(appliedFilters), sortBy, sortDir]);

  useEffect(() => {
    if (!valuePickerField) return;
    let cancelled = false;
    setValuePickerLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await produkDistributorApi.getDistinctValues(
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
          setError(err instanceof Error ? err.message : "Gagal mengambil daftar value");
        }
      } finally {
        if (!cancelled) setValuePickerLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [valuePickerField, valuePickerSearch, JSON.stringify(appliedFilters)]);

  const allColumns = data?.columns || [];
  const columnMap = useMemo(
    () => new Map(allColumns.map((column) => [column.name, column])),
    [allColumns]
  );
  const columns = useMemo(
    () =>
      DISPLAY_COLUMN_ORDER.map((name) => columnMap.get(name)).filter(
        (column): column is ProdukDistributorColumn => Boolean(column)
      ),
    [columnMap]
  );

  const activeFilterCount = Object.keys(appliedFilters).length;

  const getColumnWidth = (field: string) =>
    columnWidths[field] || DEFAULT_COLUMN_WIDTHS[field] || 180;

  const totalTableWidth =
    columns.reduce((total, column) => total + getColumnWidth(column.name), 0) +
    ACTION_WIDTH;

  const beginColumnResize = (
    event: ReactMouseEvent<HTMLDivElement>,
    field: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = getColumnWidth(field);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const width = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)
      );
      setColumnWidths((current) => ({ ...current, [field]: width }));
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

  const resetColumnWidth = (field: string) => {
    setColumnWidths((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleSort = (field: string) => {
    setPage(1);
    if (sortBy === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const rowId = (row: ProdukDistributorRecord) => String(row.id);

  const getCellValue = (row: ProdukDistributorRecord, field: string) => {
    const draft = draftRows[rowId(row)];
    return draft && field in draft
      ? draft[field]
      : row[field as keyof ProdukDistributorRecord];
  };

  const setCellValue = (
    row: ProdukDistributorRecord,
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

  const setInsertCellValue = (
    localId: string,
    field: string,
    value: string
  ) => {
    setSuccessMessage("");
    setInsertRows((current) =>
      current.map((row) =>
        row.localId === localId
          ? { ...row, values: { ...row.values, [field]: value } }
          : row
      )
    );
  };

  const getChangedValues = (row: ProdukDistributorRecord) => {
    const draft = draftRows[rowId(row)] || {};
    const changed: Record<string, unknown> = {};

    Object.entries(draft).forEach(([field, value]) => {
      const original = row[field as keyof ProdukDistributorRecord];
      if (
        String(normalizedValue(value) ?? "") !==
        String(normalizedValue(original) ?? "")
      ) {
        changed[field] = normalizedValue(value);
      }
    });

    return changed;
  };

  const pendingUpdates: ProdukDistributorBatchUpdateItem[] = (data?.items || [])
    .map((row) => ({ id: row.id, values: getChangedValues(row) }))
    .filter((item) => Object.keys(item.values).length > 0);

  const pendingCreates = insertRows.map((row) => insertPayload(row.values));
  const dirtyRowCount = pendingUpdates.length + pendingCreates.length;
  const totalChangedFields =
    pendingUpdates.reduce(
      (total, item) => total + Object.keys(item.values).length,
      0
    ) +
    insertRows.reduce(
      (total, row) =>
        total + Object.values(row.values).filter((value) => value !== "").length,
      0
    );

  const cancelRow = (row: ProdukDistributorRecord) => {
    setDraftRows((current) => {
      const next = { ...current };
      delete next[rowId(row)];
      return next;
    });
  };

  const removeInsertRow = (localId: string) => {
    setInsertRows((current) =>
      current.filter((row) => row.localId !== localId)
    );
  };

  const validateInsertRows = () => {
    for (let index = 0; index < insertRows.length; index += 1) {
      const row = insertRows[index];
      if (!row.values.Kode_Dist.trim()) {
        setError(`Row baru ${index + 1}: Kode Dist wajib diisi.`);
        return false;
      }
      if (!row.values.Kode_Produk_Dist.trim()) {
        setError(`Row baru ${index + 1}: Kode Produk Dist wajib diisi.`);
        return false;
      }
    }
    return true;
  };

  const requestBatchSave = () => {
    if (!dirtyRowCount || batchSaving) return;
    if (!validateInsertRows()) return;
    setError("");
    setBatchConfirmOpen(true);
  };

  const saveAllChanges = async () => {
    if (!dirtyRowCount || batchSaving) return;
    if (!validateInsertRows()) return;

    setBatchSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await produkDistributorApi.saveChanges(
        pendingCreates,
        pendingUpdates
      );
      setBatchConfirmOpen(false);
      setDraftRows({});
      setInsertRows([]);
      setSortBy("id");
      setSortDir("desc");
      setPage(1);
      await load();
      setSuccessMessage(
        `${response.data.created_count} row ditambahkan dan ${response.data.updated_count} row diperbarui.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save Produk Distributor gagal");
    } finally {
      setBatchSaving(false);
    }
  };

  const addInsertRow = () => {
    setInsertRows((current) => [makeInsertDraft(), ...current]);
    setSuccessMessage("");
    setError("");
  };

  const discardAll = () => {
    setDraftRows({});
    setInsertRows([]);
    setBatchConfirmOpen(false);
    setError("");
  };

  const deleteRecord = async () => {
    if (!deleteTarget || deleteSaving) return;
    setDeleteSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const deletedId = deleteTarget.id;
      await produkDistributorApi.remove(deletedId);
      setDeleteTarget(null);
      await load();
      setSuccessMessage(`Produk Distributor ID ${deletedId} berhasil dihapus.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete Produk Distributor gagal");
    } finally {
      setDeleteSaving(false);
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
    const next = { ...appliedFilters };
    if (selectedValues.length) {
      next[valuePickerField] = `__IN__:${JSON.stringify(selectedValues)}`;
    } else {
      delete next[valuePickerField];
    }
    setAppliedFilters(next);
    setPage(1);
    setValuePickerField(null);
  };

  const handlePageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const command = event.ctrlKey || event.metaKey;
    if (!command) return;

    const key = event.key.toLowerCase();
    if (key === "r") {
      event.preventDefault();
      event.stopPropagation();
      setAppliedFilters({});
      setPage(1);
      return;
    }

    if (key === "s" || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (deleteTarget || valuePickerField) return;
      if (batchConfirmOpen) void saveAllChanges();
      else requestBatchSave();
    }
  };

  const renderEditableCell = (
    row: ProdukDistributorRecord,
    column: ProdukDistributorColumn
  ) => {
    const value = getCellValue(row, column.name);
    const changed =
      column.name in (draftRows[rowId(row)] || {}) &&
      String(normalizedValue(value) ?? "") !==
        String(
          normalizedValue(row[column.name as keyof ProdukDistributorRecord]) ?? ""
        );

    if (!column.editable) {
      return (
        <td
          key={column.name}
          className="sticky left-0 z-10 overflow-hidden border-b bg-background p-2 align-top"
          style={{ width: getColumnWidth(column.name) }}
        >
          <div
            className="truncate whitespace-nowrap"
            title={String(value ?? "NULL")}
          >
            {displayValue(value)}
          </div>
          {Object.keys(getChangedValues(row)).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              onClick={() => cancelRow(row)}
            >
              Cancel Row
            </Button>
          )}
        </td>
      );
    }

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
          type="text"
          className="h-8 w-full min-w-0 border-transparent bg-transparent px-2 text-sm hover:border-input focus:border-input"
          value={value == null ? "" : String(value)}
          maxLength={column.max_length || undefined}
          onChange={(event) => setCellValue(row, column.name, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelRow(row);
          }}
        />
      </td>
    );
  };

  const renderInsertCell = (
    row: InsertDraft,
    column: ProdukDistributorColumn
  ) => {
    if (column.name === "id") {
      return (
        <td
          key={column.name}
          className="sticky left-0 z-10 border-b bg-primary/10 p-2 align-middle font-semibold text-primary"
          style={{ width: getColumnWidth(column.name) }}
        >
          NEW
        </td>
      );
    }

    return (
      <td
        key={column.name}
        className="border-b bg-primary/5 p-1 align-top"
        style={{ width: getColumnWidth(column.name) }}
      >
        <Input
          autoFocus={column.name === "Kode_Dist"}
          type="text"
          className="h-8 w-full min-w-0 bg-background px-2 text-sm"
          value={row.values[column.name] ?? ""}
          maxLength={column.max_length || undefined}
          onChange={(event) =>
            setInsertCellValue(row.localId, column.name, event.target.value)
          }
        />
      </td>
    );
  };

  return (
    <div
      className="min-w-0 space-y-4 p-3 text-sm sm:p-6"
      onKeyDownCapture={handlePageKeyDown}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Produk Distributor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD master produk distributor pada CRM.dbo.Produk_Distributor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={addInsertRow} disabled={batchSaving}>
            <Plus className="h-4 w-4" />
            Insert Row
          </Button>
          <Button
            onClick={requestBatchSave}
            disabled={!dirtyRowCount || batchSaving}
          >
            Save Changes{dirtyRowCount ? ` (${dirtyRowCount})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={discardAll}
            disabled={!dirtyRowCount || batchSaving}
          >
            Discard All
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {dirtyRowCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {dirtyRowCount} row belum disimpan
          {insertRows.length > 0 ? ` (${insertRows.length} row baru)` : ""}
          {totalChangedFields > 0 ? `, ${totalChangedFields} field terisi/berubah.` : "."}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="space-y-3 p-3 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={!activeFilterCount}
                onClick={() => {
                  setAppliedFilters({});
                  setPage(1);
                }}
              >
                Reset Filter
              </Button>
              <span className="text-muted-foreground">
                {activeFilterCount
                  ? `${activeFilterCount} filter aktif`
                  : "Tidak ada filter aktif"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              CTRL + R untuk reset filter | CTRL + S untuk save perubahan
            </span>
          </div>

          <div className="max-h-[62dvh] w-full touch-auto overflow-auto overscroll-contain rounded-md border sm:max-h-[68vh]">
            <table
              className="border-collapse text-sm"
              style={{ tableLayout: "fixed", width: totalTableWidth }}
            >
              <colgroup>
                {columns.map((column) => (
                  <col
                    key={column.name}
                    style={{ width: getColumnWidth(column.name) }}
                  />
                ))}
                <col style={{ width: ACTION_WIDTH }} />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-background shadow-sm">
                <tr>
                  {columns.map((column) => {
                    const chosenCount = parseSelectedValues(
                      appliedFilters[column.name]
                    ).length;
                    const label = displayColumnLabel(column, column.name);
                    return (
                      <th
                        key={column.name}
                        className={cn(
                          "relative border-b p-2 text-left",
                          column.name === "id" &&
                            "sticky left-0 z-30 bg-background"
                        )}
                        style={{ width: getColumnWidth(column.name) }}
                      >
                        <div className="flex min-w-0 items-center gap-1">
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-xs font-semibold tracking-wide"
                            onClick={() => toggleSort(column.name)}
                          >
                            {label}
                            {sortBy === column.name
                              ? sortDir === "asc"
                                ? " ▲"
                                : " ▼"
                              : ""}
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant={chosenCount ? "default" : "outline"}
                            className="h-7 w-7 shrink-0 p-0"
                            title={`Filter ${label}`}
                            onClick={() => openValuePicker(column.name)}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div
                          role="separator"
                          className="absolute right-0 top-0 h-full w-2 translate-x-1/2 cursor-col-resize select-none hover:bg-primary/30"
                          onMouseDown={(event) =>
                            beginColumnResize(event, column.name)
                          }
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            resetColumnWidth(column.name);
                          }}
                        />
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-30 border-b bg-background p-2 text-center text-xs font-semibold">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {insertRows.map((row) => (
                  <tr key={row.localId}>
                    {columns.map((column) => renderInsertCell(row, column))}
                    <td className="sticky right-0 border-b bg-primary/5 p-2 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Batalkan row baru"
                        aria-label="Batalkan row baru"
                        onClick={() => removeInsertRow(row.localId)}
                        disabled={batchSaving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {data?.items.length ? (
                  data.items.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      {columns.map((column) => renderEditableCell(row, column))}
                      <td className="sticky right-0 border-b bg-background p-2 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title={`Delete ID ${row.id}`}
                          aria-label={`Delete Produk Distributor ID ${row.id}`}
                          onClick={() => setDeleteTarget(row)}
                          disabled={batchSaving || deleteSaving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : insertRows.length ? null : loading ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-8 text-center">
                      Memuat data CRM...
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Tidak ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            pageSize={pageSize}
            totalPages={data?.total_pages ?? 1}
            totalRows={data?.total ?? 0}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {batchConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Confirm Save</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Simpan <strong>{dirtyRowCount}</strong> row perubahan ke CRM?
              </p>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div>Row baru: {pendingCreates.length}</div>
                <div>Row diedit: {pendingUpdates.length}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Semua insert dan update akan disimpan dalam satu transaksi.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setBatchConfirmOpen(false)}
                  disabled={batchSaving}
                >
                  Cancel
                </Button>
                <Button onClick={() => void saveAllChanges()} disabled={batchSaving}>
                  {batchSaving ? "Saving..." : `Save ${dirtyRowCount} Rows`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Delete Produk Distributor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div>
                  <strong>ID:</strong> {deleteTarget.id}
                </div>
                <div>
                  <strong>Kode Dist:</strong> {deleteTarget.Kode_Dist}
                </div>
                <div>
                  <strong>Name Dist:</strong> {deleteTarget.temp || "NULL"}
                </div>
                <div>
                  <strong>Kode Produk Dist:</strong> {deleteTarget.Kode_Produk_Dist}
                </div>
                <div>
                  <strong>Nama Produk Dist:</strong>{" "}
                  {deleteTarget.Nama_Produk_Dist || "NULL"}
                </div>
              </div>
              <p className="text-destructive">
                Data akan dihapus langsung dari CRM.dbo.Produk_Distributor dan tidak
                dapat di-undo dari aplikasi.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void deleteRecord()}
                  disabled={deleteSaving}
                >
                  {deleteSaving ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {valuePickerField && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-0 sm:p-6">
          <div className="flex min-h-full items-start justify-center sm:items-center sm:py-4">
            <Card className="flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none sm:h-[min(760px,calc(100vh-3rem))] sm:rounded-xl">
              <CardHeader className="shrink-0 border-b">
                <CardTitle>
                  FILTER BY VALUE:{" "}
                  {displayColumnLabel(
                    columnMap.get(valuePickerField),
                    valuePickerField
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div className="space-y-3 border-b p-4 sm:px-6">
                  <Input
                    autoFocus
                    placeholder="Cari value..."
                    value={valuePickerSearch}
                    onChange={(event) => setValuePickerSearch(event.target.value)}
                  />
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span>{selectedValues.length} value dipilih</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedValues([])}
                    >
                      Reset pilihan
                    </Button>
                  </div>
                </div>

                <div className="m-4 min-h-0 flex-1 overflow-auto rounded-md border sm:mx-6">
                  {valuePickerLoading ? (
                    <div className="p-6 text-center">Memuat value...</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr>
                          <th className="w-12 border-b p-3"></th>
                          <th className="border-b p-3 text-left">VALUE</th>
                          <th className="w-28 border-b p-3 text-right">ROWS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valuePickerValues.length ? (
                          valuePickerValues.map((item, index) => {
                            const value = item.value as SelectedValue;
                            const checked = selectedValues.some(
                              (selected) => valueKey(selected) === valueKey(value)
                            );
                            return (
                              <tr
                                key={`${valueKey(value)}-${index}`}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSelectedValue(value)}
                              >
                                <td className="border-b p-3 text-center">
                                  <input type="checkbox" checked={checked} readOnly />
                                </td>
                                <td className="break-words border-b p-3">
                                  {value === null ? (
                                    <span className="italic text-muted-foreground">
                                      NULL
                                    </span>
                                  ) : (
                                    String(value)
                                  )}
                                </td>
                                <td className="border-b p-3 text-right tabular-nums">
                                  {item.row_count}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={3}
                              className="p-6 text-center text-muted-foreground"
                            >
                              Value tidak ditemukan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t p-4 sm:px-6">
                  <Button
                    variant="outline"
                    onClick={() => setValuePickerField(null)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={applySelectedValues}>OK</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

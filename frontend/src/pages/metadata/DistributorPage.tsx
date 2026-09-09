import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Copy, Filter, Plus, Trash2 } from "lucide-react";
import { appFetch, DistinctValue } from "@/lib/appApi";
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

type DistributorColumn = {
  name: string;
  label: string;
  data_type: string;
  is_nullable: boolean;
  max_length?: number | null;
  editable: boolean;
};

type DistributorRecord = {
  iddistributor: number;
  Kode_Dist?: string | null;
  Kode_Dist_Grup?: string | null;
  Nama_Dist?: string | null;
  Nama_Dist_Grup?: string | null;
  Tgl_Gabung?: string | null;
  Tgl_Data_Pertama?: string | null;
  status?: string | null;
};

type DistributorPageData = {
  items: DistributorRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  columns: DistributorColumn[];
};

type DistributorCreateInput = {
  Kode_Dist: string;
  Kode_Dist_Grup: string;
  Nama_Dist: string;
  Nama_Dist_Grup: string;
  Tgl_Gabung: string;
  Tgl_Data_Pertama: string;
  status: string;
};

type DistributorBatchUpdateItem = {
  id: number;
  values: Record<string, unknown>;
};

type InsertDraft = {
  localId: string;
  values: Record<string, string>;
};

type SaveResult = {
  created_count: number;
  created_ids: number[];
  updated_count: number;
  updated_ids: number[];
  deleted_count: number;
  deleted_ids: number[];
};

const DISPLAY_COLUMN_ORDER = [
  "iddistributor",
  "Kode_Dist",
  "Kode_Dist_Grup",
  "Nama_Dist",
  "Nama_Dist_Grup",
  "Tgl_Gabung",
  "Tgl_Data_Pertama",
  "status",
];

const DATE_FIELDS = new Set(["Tgl_Gabung", "Tgl_Data_Pertama"]);

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  iddistributor: 100,
  Kode_Dist: 160,
  Kode_Dist_Grup: 190,
  Nama_Dist: 300,
  Nama_Dist_Grup: 300,
  Tgl_Gabung: 180,
  Tgl_Data_Pertama: 200,
  status: 170,
};

const MIN_COLUMN_WIDTH = 100;
const MAX_COLUMN_WIDTH = 700;
const ACTION_WIDTH = 96;

const EMPTY_INSERT: Record<string, string> = {
  Kode_Dist: "",
  Kode_Dist_Grup: "",
  Nama_Dist: "",
  Nama_Dist_Grup: "",
  Tgl_Gabung: "",
  Tgl_Data_Pertama: "",
  status: "1",
};

const REQUIRED_FIELDS: Array<{ field: string; label: string }> = [
  { field: "Kode_Dist", label: "DIST CODE" },
  { field: "Kode_Dist_Grup", label: "DIST CODE GROUP" },
  { field: "Nama_Dist", label: "DIST NAME" },
  { field: "Nama_Dist_Grup", label: "DIST NAME GROUP" },
  { field: "Tgl_Gabung", label: "TANGGAL GABUNG" },
  { field: "Tgl_Data_Pertama", label: "TANGGAL DATA PERTAMA" },
  { field: "status", label: "STATUS AKTIF" },
];

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

function dateInputValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmySlash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    return `${dmySlash[3]}-${dmySlash[2].padStart(2, "0")}-${dmySlash[1].padStart(2, "0")}`;
  }

  const dmyDash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    return `${dmyDash[3]}-${dmyDash[2].padStart(2, "0")}-${dmyDash[1].padStart(2, "0")}`;
  }

  const ymdSlash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, "0")}-${ymdSlash[3].padStart(2, "0")}`;
  }

  return "";
}

function storedDateValue(value: unknown) {
  const date = dateInputValue(value);
  return date ? `${date} 00:00:00` : "";
}

function displayValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-muted-foreground">NULL</span>;
  }
  if (DATE_FIELDS.has(field)) {
    const date = dateInputValue(value);
    return date || String(value);
  }
  if (field === "status") {
    return String(value) === "1" ? "ACTIVE" : "INACTIVE";
  }
  return String(value);
}

function makeInsertDraft(
  values: Record<string, string> = EMPTY_INSERT
): InsertDraft {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    values: { ...EMPTY_INSERT, ...values },
  };
}

function insertPayload(values: Record<string, string>): DistributorCreateInput {
  return {
    Kode_Dist: values.Kode_Dist.trim(),
    Kode_Dist_Grup: values.Kode_Dist_Grup.trim(),
    Nama_Dist: values.Nama_Dist.trim(),
    Nama_Dist_Grup: values.Nama_Dist_Grup.trim(),
    Tgl_Gabung: storedDateValue(values.Tgl_Gabung),
    Tgl_Data_Pertama: storedDateValue(values.Tgl_Data_Pertama),
    status: values.status === "1" ? "1" : "0",
  };
}

function StatusSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
          checked
            ? "border-emerald-500 bg-emerald-500"
            : "border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      <span
        className={cn(
          "text-xs font-semibold",
          checked
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground"
        )}
      >
        {checked ? "ACTIVE" : "INACTIVE"}
      </span>
    </div>
  );
}

export default function DistributorPage() {
  const [data, setData] = useState<DistributorPageData | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("iddistributor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [draftRows, setDraftRows] = useState<Record<string, DraftValues>>({});
  const [insertRows, setInsertRows] = useState<InsertDraft[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
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
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        filters: JSON.stringify(appliedFilters),
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      const response = await appFetch<DistributorPageData>(
        `/distributor?${query.toString()}`
      );
      setData(response.data);
      if (response.data.page !== page) setPage(response.data.page);
      setDraftRows({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil Distributor");
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
        const query = new URLSearchParams({
          limit: "200",
          filters: JSON.stringify(appliedFilters),
        });
        if (valuePickerSearch) query.set("search", valuePickerSearch);
        const response = await appFetch<DistinctValue[]>(
          `/distributor/values/${encodeURIComponent(valuePickerField)}?${query.toString()}`
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
        (column): column is DistributorColumn => Boolean(column)
      ),
    [columnMap]
  );

  const activeFilterCount = Object.keys(appliedFilters).length;
  const pendingDeleteSet = useMemo(
    () => new Set(pendingDeleteIds),
    [pendingDeleteIds]
  );

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

  const rowId = (row: DistributorRecord) => String(row.iddistributor);

  const getCellValue = (row: DistributorRecord, field: string) => {
    const draft = draftRows[rowId(row)];
    return draft && field in draft
      ? draft[field]
      : row[field as keyof DistributorRecord];
  };

  const setCellValue = (
    row: DistributorRecord,
    field: string,
    value: unknown
  ) => {
    if (pendingDeleteSet.has(row.iddistributor)) return;
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

  const getChangedValues = (row: DistributorRecord) => {
    const draft = draftRows[rowId(row)] || {};
    const changed: Record<string, unknown> = {};

    Object.entries(draft).forEach(([field, value]) => {
      const original = row[field as keyof DistributorRecord];
      if (
        String(normalizedValue(value) ?? "") !==
        String(normalizedValue(original) ?? "")
      ) {
        changed[field] = normalizedValue(value);
      }
    });

    return changed;
  };

  const pendingUpdates: DistributorBatchUpdateItem[] = (data?.items || [])
    .filter((row) => !pendingDeleteSet.has(row.iddistributor))
    .map((row) => ({
      id: row.iddistributor,
      values: getChangedValues(row),
    }))
    .filter((item) => Object.keys(item.values).length > 0);

  const pendingCreates = insertRows.map((row) => insertPayload(row.values));
  const dirtyRowCount =
    pendingUpdates.length + pendingCreates.length + pendingDeleteIds.length;
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

  const cancelRow = (row: DistributorRecord) => {
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

  const duplicateInsertRow = (row: InsertDraft) => {
    setInsertRows((current) => [makeInsertDraft(row.values), ...current]);
    setSuccessMessage("");
    setError("");
  };

  const duplicateExistingRow = (row: DistributorRecord) => {
    const values = Object.keys(EMPTY_INSERT).reduce<Record<string, string>>(
      (result, field) => {
        const value = getCellValue(row, field);
        result[field] = value === null || value === undefined ? "" : String(value);
        return result;
      },
      {}
    );
    setInsertRows((current) => [makeInsertDraft(values), ...current]);
    setSuccessMessage("");
    setError("");
  };

  const togglePendingDelete = (row: DistributorRecord) => {
    setPendingDeleteIds((current) =>
      current.includes(row.iddistributor)
        ? current.filter((id) => id !== row.iddistributor)
        : [...current, row.iddistributor]
    );
    setSuccessMessage("");
    setError("");
  };

  const validateValues = (
    values: Record<string, unknown>,
    rowLabel: string
  ) => {
    for (const required of REQUIRED_FIELDS) {
      if (!String(values[required.field] ?? "").trim()) {
        setError(`${rowLabel}: ${required.label} wajib diisi.`);
        return false;
      }
    }

    if (!dateInputValue(values.Tgl_Gabung)) {
      setError(`${rowLabel}: TANGGAL GABUNG harus berupa tanggal valid.`);
      return false;
    }
    if (!dateInputValue(values.Tgl_Data_Pertama)) {
      setError(`${rowLabel}: TANGGAL DATA PERTAMA harus berupa tanggal valid.`);
      return false;
    }
    if (!new Set(["0", "1"]).has(String(values.status))) {
      setError(`${rowLabel}: STATUS AKTIF tidak valid.`);
      return false;
    }
    return true;
  };

  const validatePendingChanges = () => {
    for (let index = 0; index < insertRows.length; index += 1) {
      if (!validateValues(insertRows[index].values, `Row baru ${index + 1}`)) {
        return false;
      }
    }

    for (const item of pendingUpdates) {
      const original = data?.items.find(
        (row) => row.iddistributor === item.id
      );
      if (!original) continue;
      const merged: Record<string, unknown> = {};
      REQUIRED_FIELDS.forEach(({ field }) => {
        merged[field] =
          field in item.values
            ? item.values[field]
            : original[field as keyof DistributorRecord];
      });
      if (!validateValues(merged, `ID ${item.id}`)) return false;
    }

    return true;
  };

  const requestBatchSave = () => {
    if (!dirtyRowCount || batchSaving) return;
    if (!validatePendingChanges()) return;
    setError("");
    setBatchConfirmOpen(true);
  };

  const saveAllChanges = async () => {
    if (!dirtyRowCount || batchSaving) return;
    if (!validatePendingChanges()) return;

    setBatchSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await appFetch<SaveResult>("/distributor/save", {
        method: "POST",
        body: JSON.stringify({
          creates: pendingCreates,
          updates: pendingUpdates,
          deletes: pendingDeleteIds,
        }),
      });
      setBatchConfirmOpen(false);
      setDraftRows({});
      setInsertRows([]);
      setPendingDeleteIds([]);
      setSortBy("iddistributor");
      setSortDir("desc");
      setPage(1);
      await load();
      setSuccessMessage(
        `${response.data.created_count} row ditambahkan, ${response.data.updated_count} row diperbarui, dan ${response.data.deleted_count} row dihapus.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save Distributor gagal");
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
    setPendingDeleteIds([]);
    setBatchConfirmOpen(false);
    setError("");
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
    if (event.key === "Enter" && batchConfirmOpen && !valuePickerField) {
      event.preventDefault();
      event.stopPropagation();
      void saveAllChanges();
      return;
    }

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

    if (key === "s") {
      event.preventDefault();
      event.stopPropagation();
      if (valuePickerField) return;
      if (batchConfirmOpen) void saveAllChanges();
      else requestBatchSave();
    }
  };

  const renderEditableCell = (
    row: DistributorRecord,
    column: DistributorColumn,
    isPendingDelete: boolean
  ) => {
    const value = getCellValue(row, column.name);
    const changed =
      column.name in (draftRows[rowId(row)] || {}) &&
      String(normalizedValue(value) ?? "") !==
        String(
          normalizedValue(row[column.name as keyof DistributorRecord]) ?? ""
        );

    if (!column.editable) {
      return (
        <td
          key={column.name}
          className={cn(
            "overflow-hidden border-b p-2 align-middle",
            column.name === "iddistributor" && "sticky left-0 z-10",
            isPendingDelete ? "bg-destructive/10 line-through" : "bg-background"
          )}
          style={{ width: getColumnWidth(column.name) }}
        >
          <div className="truncate whitespace-nowrap" title={String(value ?? "NULL")}>
            {displayValue(column.name, value)}
          </div>
          {column.name === "iddistributor" &&
            !isPendingDelete &&
            Object.keys(getChangedValues(row)).length > 0 && (
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

    if (column.name === "status") {
      const checked = String(value) === "1";
      return (
        <td
          key={column.name}
          className={cn(
            "overflow-hidden border-b p-1 align-middle",
            isPendingDelete && "bg-destructive/10 line-through",
            !isPendingDelete && changed && "bg-amber-100 dark:bg-amber-950/40"
          )}
          style={{ width: getColumnWidth(column.name) }}
        >
          <StatusSwitch
            checked={checked}
            disabled={isPendingDelete}
            onChange={() => setCellValue(row, column.name, checked ? "0" : "1")}
          />
        </td>
      );
    }

    if (DATE_FIELDS.has(column.name)) {
      return (
        <td
          key={column.name}
          className={cn(
            "overflow-hidden border-b p-1 align-top",
            isPendingDelete && "bg-destructive/10 line-through",
            !isPendingDelete && changed && "bg-amber-100 dark:bg-amber-950/40"
          )}
          style={{ width: getColumnWidth(column.name) }}
        >
          <Input
            type="date"
            disabled={isPendingDelete}
            className={cn(
              "h-8 w-full min-w-0 border-transparent bg-transparent px-2 text-sm hover:border-input focus:border-input",
              isPendingDelete && "line-through opacity-70"
            )}
            value={dateInputValue(value)}
            onChange={(event) =>
              setCellValue(
                row,
                column.name,
                event.target.value ? `${event.target.value} 00:00:00` : ""
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelRow(row);
            }}
          />
        </td>
      );
    }

    return (
      <td
        key={column.name}
        className={cn(
          "overflow-hidden border-b p-1 align-top",
          isPendingDelete && "bg-destructive/10 line-through",
          !isPendingDelete && changed && "bg-amber-100 dark:bg-amber-950/40"
        )}
        style={{ width: getColumnWidth(column.name) }}
      >
        <Input
          type="text"
          disabled={isPendingDelete}
          className={cn(
            "h-8 w-full min-w-0 border-transparent bg-transparent px-2 text-sm hover:border-input focus:border-input",
            isPendingDelete && "line-through opacity-70"
          )}
          value={value == null ? "" : String(value)}
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
    column: DistributorColumn
  ) => {
    if (column.name === "iddistributor") {
      return (
        <td
          key={column.name}
          className="sticky left-0 z-10 border-b border-amber-300 bg-amber-200 p-2 align-middle font-bold text-amber-950 dark:border-amber-700 dark:bg-amber-900/80 dark:text-amber-100"
          style={{ width: getColumnWidth(column.name) }}
        >
          NEW
        </td>
      );
    }

    if (column.name === "status") {
      const checked = row.values.status === "1";
      return (
        <td
          key={column.name}
          className="border-b border-amber-300 bg-amber-100 p-1 align-middle dark:border-amber-800 dark:bg-amber-950/60"
          style={{ width: getColumnWidth(column.name) }}
        >
          <StatusSwitch
            checked={checked}
            onChange={() =>
              setInsertCellValue(row.localId, "status", checked ? "0" : "1")
            }
          />
        </td>
      );
    }

    if (DATE_FIELDS.has(column.name)) {
      return (
        <td
          key={column.name}
          className="border-b border-amber-300 bg-amber-100 p-1 align-middle dark:border-amber-800 dark:bg-amber-950/60"
          style={{ width: getColumnWidth(column.name) }}
        >
          <Input
            type="date"
            className="h-8 w-full min-w-0 border-amber-300 bg-amber-50 px-2 text-sm dark:border-amber-800 dark:bg-amber-950/40"
            value={dateInputValue(row.values[column.name])}
            onChange={(event) =>
              setInsertCellValue(
                row.localId,
                column.name,
                event.target.value ? `${event.target.value} 00:00:00` : ""
              )
            }
          />
        </td>
      );
    }

    return (
      <td
        key={column.name}
        className="border-b border-amber-300 bg-amber-100 p-1 align-middle dark:border-amber-800 dark:bg-amber-950/60"
        style={{ width: getColumnWidth(column.name) }}
      >
        <Input
          autoFocus={column.name === "Kode_Dist"}
          type="text"
          className="h-8 w-full min-w-0 border-amber-300 bg-amber-50 px-2 text-sm dark:border-amber-800 dark:bg-amber-950/40"
          value={row.values[column.name] ?? ""}
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
          <h1 className="text-xl font-bold sm:text-2xl">Distributor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD master distributor pada bronze_so.distributor.
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
          {insertRows.length > 0 ? `, ${insertRows.length} row baru` : ""}
          {pendingUpdates.length > 0 ? `, ${pendingUpdates.length} row diedit` : ""}
          {pendingDeleteIds.length > 0 ? `, ${pendingDeleteIds.length} row akan dihapus` : ""}
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
                    return (
                      <th
                        key={column.name}
                        className={cn(
                          "relative border-b p-2 text-left",
                          column.name === "iddistributor" &&
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
                            {column.label}
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
                            title={`Filter ${column.label}`}
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
                  <tr
                    key={row.localId}
                    className="bg-amber-100 dark:bg-amber-950/60"
                  >
                    {columns.map((column) => renderInsertCell(row, column))}
                    <td className="sticky right-0 border-b border-amber-300 bg-amber-100 p-2 align-middle text-center dark:border-amber-800 dark:bg-amber-950/60">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 border-emerald-500 bg-emerald-100 p-0 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                          title="Duplicate row baru"
                          aria-label="Duplicate row baru"
                          onClick={() => duplicateInsertRow(row)}
                          disabled={batchSaving}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 border-amber-400 bg-amber-50 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-amber-700 dark:bg-amber-950/40"
                          title="Batalkan row baru"
                          aria-label="Batalkan row baru"
                          onClick={() => removeInsertRow(row.localId)}
                          disabled={batchSaving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {data?.items.length ? (
                  data.items.map((row) => {
                    const isPendingDelete = pendingDeleteSet.has(row.iddistributor);
                    return (
                      <tr
                        key={row.iddistributor}
                        className={cn(
                          "hover:bg-muted/30",
                          isPendingDelete && "bg-destructive/10 opacity-70 line-through"
                        )}
                      >
                        {columns.map((column) =>
                          renderEditableCell(row, column, isPendingDelete)
                        )}
                        <td
                          className={cn(
                            "sticky right-0 border-b p-2 text-center",
                            isPendingDelete ? "bg-destructive/10" : "bg-background"
                          )}
                        >
                          <div className="flex items-center justify-center gap-1 no-underline">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 border-emerald-500 bg-emerald-100 p-0 text-emerald-700 no-underline hover:bg-emerald-200 hover:text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                              title={`Duplicate ID ${row.iddistributor}`}
                              aria-label={`Duplicate Distributor ID ${row.iddistributor}`}
                              onClick={() => duplicateExistingRow(row)}
                              disabled={batchSaving}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant={isPendingDelete ? "outline" : "destructive"}
                              size="sm"
                              className={cn(
                                "h-8 w-8 p-0 no-underline",
                                isPendingDelete &&
                                  "border-destructive text-destructive hover:bg-destructive/10"
                              )}
                              title={
                                isPendingDelete
                                  ? `Batalkan delete ID ${row.iddistributor}`
                                  : `Delete ID ${row.iddistributor}`
                              }
                              aria-label={
                                isPendingDelete
                                  ? `Batalkan delete Distributor ID ${row.iddistributor}`
                                  : `Delete Distributor ID ${row.iddistributor}`
                              }
                              onClick={() => togglePendingDelete(row)}
                              disabled={batchSaving}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : insertRows.length ? null : loading ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-8 text-center">
                      Memuat data Distributor...
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
                Simpan <strong>{dirtyRowCount}</strong> row perubahan?
              </p>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div>Row baru: {pendingCreates.length}</div>
                <div>Row diedit: {pendingUpdates.length}</div>
                <div>Row dihapus: {pendingDeleteIds.length}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Semua insert, update, dan delete akan disimpan dalam satu transaksi.
                Tekan Enter untuk menyimpan.
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

      {valuePickerField && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-0 sm:p-6">
          <div className="flex min-h-full items-start justify-center sm:items-center sm:py-4">
            <Card className="flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none sm:h-[min(760px,calc(100vh-3rem))] sm:rounded-xl">
              <CardHeader className="shrink-0 border-b">
                <CardTitle>
                  FILTER BY VALUE:{" "}
                  {columnMap.get(valuePickerField)?.label || valuePickerField}
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

                  {selectedValues.length > 0 && (
                    <div className="flex max-h-24 flex-wrap gap-2 overflow-auto rounded-lg border bg-background p-2 sm:p-3">
                      {selectedValues.map((value) => (
                        <button
                          key={valueKey(value)}
                          type="button"
                          onClick={() => toggleSelectedValue(value)}
                          className="max-w-full truncate rounded-full border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70"
                          title="Klik untuk melepas value"
                        >
                          {value === null ? "NULL" : String(value)} ×
                        </button>
                      ))}
                    </div>
                  )}
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

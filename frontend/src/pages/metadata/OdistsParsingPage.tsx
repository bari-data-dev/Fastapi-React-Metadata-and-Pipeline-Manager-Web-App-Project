import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { odistsApi, OdistsColumn, OdistsPage, DistinctValue } from "@/lib/appApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_COLUMNS = ["id", "ogal_id", "dist_code", "cust_code", "cust_name", "address", "type_outlet", "city", "province", "kecamatan", "kota", "provinsi", "status_upd", "updated_by", "parsed_at", "dwh_refreshed_at"];
const DATE_FIELDS = new Set(["created_at", "updated_at", "parsed_at", "dwh_loaded_at", "dwh_refreshed_at"]);

type SelectedValue = string | number | null;

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

function renderValue(field: string, value: unknown) {
  if (value === null || value === undefined) return <span className="italic text-muted-foreground">NULL</span>;
  if (DATE_FIELDS.has(field)) return formatDate(value);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
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
  const [data, setData] = useState<OdistsPage | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [fieldSearch, setFieldSearch] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draftRows, setDraftRows] = useState<Record<string, Record<string, unknown>>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [valuePickerField, setValuePickerField] = useState<string | null>(null);
  const [valuePickerSearch, setValuePickerSearch] = useState("");
  const [valuePickerValues, setValuePickerValues] = useState<DistinctValue[]>([]);
  const [valuePickerLoading, setValuePickerLoading] = useState(false);
  const [selectedValues, setSelectedValues] = useState<SelectedValue[]>([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await odistsApi.getPage({ page, pageSize, columns: visibleColumns, filters: appliedFilters, sortBy, sortDir });
      setData(response.data);
      setDraftRows({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, pageSize, visibleColumns.join(","), JSON.stringify(appliedFilters), sortBy, sortDir]);

  useEffect(() => {
    if (!valuePickerField) return;
    let cancelled = false;
    setValuePickerLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await odistsApi.getDistinctValues(valuePickerField, valuePickerSearch, 100);
        if (!cancelled) {
          setValuePickerValues(response.data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setValuePickerValues([]);
          setError(err instanceof Error ? err.message : "Gagal mengambil daftar nilai");
        }
      } finally {
        if (!cancelled) setValuePickerLoading(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [valuePickerField, valuePickerSearch]);

  const metadata = data?.columns || [];
  const metadataMap = useMemo(() => new Map(metadata.map((column) => [column.name, column])), [metadata]);
  const filteredFields = metadata.filter((column) => `${column.name} ${column.label}`.toLowerCase().includes(fieldSearch.toLowerCase()));

  const toggleColumn = (name: string) => {
    setPage(1);
    setVisibleColumns((current) => {
      if (name === "id") return current;
      return current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
    });
  };

  const toggleSort = (name: string) => {
    setPage(1);
    if (sortBy === name) setSortDir((current) => current === "asc" ? "desc" : "asc");
    else { setSortBy(name); setSortDir("asc"); }
  };

  const applyFilters = () => { setPage(1); setAppliedFilters(filters); };
  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") applyFilters(); };
  const rowId = (row: Record<string, unknown>) => String(row.id);
  const getCellValue = (row: Record<string, unknown>, field: string) => {
    const draft = draftRows[rowId(row)];
    return draft && field in draft ? draft[field] : row[field];
  };

  const setCellValue = (row: Record<string, unknown>, field: string, value: unknown) => {
    const id = rowId(row);
    setDraftRows((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  };

  const getChangedValues = (row: Record<string, unknown>) => {
    const draft = draftRows[rowId(row)] || {};
    const changed: Record<string, unknown> = {};
    Object.entries(draft).forEach(([field, value]) => {
      const nextValue = normalizedValue(value);
      const originalValue = normalizedValue(row[field]);
      if (String(nextValue ?? "") !== String(originalValue ?? "")) changed[field] = nextValue;
    });
    return changed;
  };

  const isRowDirty = (row: Record<string, unknown>) => Object.keys(getChangedValues(row)).length > 0;
  const cancelRow = (row: Record<string, unknown>) => {
    const id = rowId(row);
    setDraftRows((current) => { const next = { ...current }; delete next[id]; return next; });
  };

  const saveRow = async (row: Record<string, unknown>) => {
    const id = rowId(row);
    const changed = getChangedValues(row);
    if (!Object.keys(changed).length) return;
    setSavingRows((current) => ({ ...current, [id]: true }));
    setError("");
    try {
      await odistsApi.update(Number(row.id), changed);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update gagal");
    } finally {
      setSavingRows((current) => ({ ...current, [id]: false }));
    }
  };

  const openValuePicker = (field: string) => {
    setValuePickerValues([]);
    setValuePickerSearch("");
    setSelectedValues(parseSelectedValues(filters[field]));
    setValuePickerField(field);
  };

  const toggleSelectedValue = (value: SelectedValue) => {
    const key = valueKey(value);
    setSelectedValues((current) => current.some((item) => valueKey(item) === key) ? current.filter((item) => valueKey(item) !== key) : [...current, value]);
  };

  const applySelectedValues = () => {
    if (!valuePickerField) return;
    const nextFilters = { ...filters };
    if (selectedValues.length) nextFilters[valuePickerField] = `__IN__:${JSON.stringify(selectedValues)}`;
    else delete nextFilters[valuePickerField];
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    setValuePickerField(null);
  };

  const resetSelectedValues = () => setSelectedValues([]);

  const renderEditableCell = (row: Record<string, unknown>, column: OdistsColumn) => {
    const value = getCellValue(row, column.name);
    const changed = column.name in (draftRows[rowId(row)] || {}) && String(normalizedValue(value) ?? "") !== String(normalizedValue(row[column.name]) ?? "");
    return (
      <td key={column.name} className={`border-b p-1 align-top min-w-40 ${changed ? "bg-amber-100 dark:bg-amber-950/40" : ""}`}>
        <Input className="h-8 min-w-36 border-transparent bg-transparent text-sm hover:border-input focus:border-input" value={value == null ? "" : String(value)} onChange={(event) => setCellValue(row, column.name, event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && isRowDirty(row)) { event.preventDefault(); void saveRow(row); }
          if (event.key === "Escape") cancelRow(row);
        }} />
      </td>
    );
  };

  return (
    <div className="p-6 space-y-4 min-w-0 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ODIST Parsing</h1>
          <p className="text-sm text-muted-foreground">Sumber MySQL pipeline_bigdata.gold_odists_parsing_manual. Klik cell untuk edit.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFields((value) => !value)}>Field List</Button>
          <Button variant="outline" onClick={() => void load()}>Refresh</Button>
        </div>
      </div>

      {showFields && <Card><CardHeader><CardTitle className="text-base">Pilih Kolom</CardTitle></CardHeader><CardContent className="space-y-3">
        <Input placeholder="Cari nama field..." value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-auto">
          {filteredFields.map((column) => <label key={column.name} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visibleColumns.includes(column.name)} disabled={column.name === "id"} onChange={() => toggleColumn(column.name)} />{column.label}</label>)}
        </div>
      </CardContent></Card>}

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <Button onClick={applyFilters}>Terapkan Filter</Button>
          <Button variant="outline" onClick={() => { setFilters({}); setAppliedFilters({}); setPage(1); }}>Reset Filter</Button>
          <label className="text-sm ml-auto">Rows<select className="ml-2 border rounded px-2 py-2 bg-background" value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }}>{[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="overflow-auto border rounded-md max-h-[68vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-background z-10"><tr>{visibleColumns.map((name) => {
              const column = metadataMap.get(name);
              const chosenCount = parseSelectedValues(filters[name]).length;
              return <th key={name} className="border-b p-2 text-left min-w-44 align-top">
                <button className="font-semibold text-sm" onClick={() => toggleSort(name)}>{column?.label || name}{sortBy === name ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>
                <div className="flex gap-1 mt-2">
                  <Input className="h-8 font-normal min-w-28 text-sm" placeholder={chosenCount ? `${chosenCount} value dipilih` : "Filter..."} value={filters[name]?.startsWith("__IN__:") ? "" : filters[name] || ""} onChange={(event) => setFilters((current) => ({ ...current, [name]: event.target.value }))} onKeyDown={handleFilterKeyDown} />
                  <Button type="button" size="sm" variant={chosenCount ? "default" : "outline"} className="h-8 px-2" title="Choose value" onClick={() => openValuePicker(name)}>⋯</Button>
                </div>
              </th>;
            })}</tr></thead>
            <tbody>
              {loading ? <tr><td className="p-6 text-center" colSpan={visibleColumns.length}>Memuat data...</td></tr> : data?.items.length ? data.items.map((row) => {
                const dirty = isRowDirty(row);
                const saving = Boolean(savingRows[rowId(row)]);
                return <tr key={rowId(row)} className={dirty ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-muted/40"}>{visibleColumns.map((name) => {
                  const column = metadataMap.get(name);
                  if (column?.editable) return renderEditableCell(row, column);
                  return <td key={name} className="border-b p-2 align-top whitespace-nowrap" title={row[name] == null ? "NULL" : String(row[name])}>{renderValue(name, row[name])}{name === "id" && dirty && <div className="flex gap-1 mt-2"><Button size="sm" onClick={() => void saveRow(row)} disabled={saving}>{saving ? "Saving..." : "Save"}</Button><Button size="sm" variant="outline" onClick={() => cancelRow(row)} disabled={saving}>Cancel</Button></div>}</td>;
                })}</tr>;
              }) : <tr><td className="p-6 text-center" colSpan={visibleColumns.length}>Tidak ada data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm"><span>Total {data?.total ?? 0} row</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {data?.page ?? page} / {data?.total_pages ?? 1}</span><Button variant="outline" size="sm" disabled={page >= (data?.total_pages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
      </CardContent></Card>

      {valuePickerField && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[88vh] flex flex-col shadow-xl">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Choose Value: {metadataMap.get(valuePickerField)?.label || valuePickerField}</CardTitle><p className="text-sm text-muted-foreground">Pilih beberapa value. Pilihan tetap tersimpan saat Anda mencari value lain.</p></CardHeader>
          <CardContent className="space-y-4 overflow-hidden flex flex-col text-sm">
            <Input autoFocus className="h-10 text-sm" placeholder="Ketik untuk mencari value..." value={valuePickerSearch} onChange={(event) => setValuePickerSearch(event.target.value)} />
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"><span className="font-medium">{selectedValues.length} value dipilih</span><Button size="sm" variant="ghost" onClick={resetSelectedValues}>Reset pilihan</Button></div>
            {selectedValues.length > 0 && <div className="flex flex-wrap gap-2 max-h-24 overflow-auto rounded-md border p-2 bg-background">{selectedValues.map((value) => <button key={valueKey(value)} type="button" onClick={() => toggleSelectedValue(value)} className="rounded-full border bg-muted px-3 py-1 text-xs hover:bg-muted/70">{value === null ? "NULL" : String(value)} ×</button>)}</div>}
            <div className="border rounded-md overflow-auto max-h-[48vh]">
              {valuePickerLoading ? <div className="p-5 text-center text-muted-foreground">Memuat value...</div> : <table className="w-full text-sm"><thead className="sticky top-0 bg-background"><tr><th className="w-12 p-3 border-b"></th><th className="text-left p-3 border-b font-semibold">Value</th><th className="text-right p-3 border-b w-28 font-semibold">Rows</th></tr></thead><tbody>{valuePickerValues.length ? valuePickerValues.map((item, index) => {
                const checked = selectedValues.some((value) => valueKey(value) === valueKey(item.value as SelectedValue));
                return <tr key={`${valueKey(item.value as SelectedValue)}-${index}`} className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleSelectedValue(item.value as SelectedValue)}><td className="p-3 border-b text-center"><input type="checkbox" checked={checked} readOnly /></td><td className="p-3 border-b break-words">{item.value === null ? <span className="italic text-muted-foreground">NULL</span> : String(item.value)}</td><td className="p-3 border-b text-right tabular-nums">{item.row_count}</td></tr>;
              }) : <tr><td className="p-5 text-center text-muted-foreground" colSpan={3}>Value tidak ditemukan.</td></tr>}</tbody></table>}
            </div>
            <div className="flex justify-between gap-2 pt-1"><Button variant="outline" onClick={resetSelectedValues}>Reset</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setValuePickerField(null)}>Cancel</Button><Button onClick={applySelectedValues}>OK</Button></div></div>
          </CardContent>
        </Card>
      </div>}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { odistsApi, OdistsColumn, OdistsPage } from "@/lib/appApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const DEFAULT_COLUMNS = [
  "id", "ogal_id", "old_ogal_id", "dist_code", "cust_code", "cust_name",
  "address", "type_outlet", "city", "province", "kecamatan", "kota",
  "provinsi", "batch", "status_upd", "updated_by", "parsed_at", "dwh_refreshed_at",
];

function displayValue(value: unknown) {
  if (value === null || value === undefined) return <span className="italic text-muted-foreground">NULL</span>;
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
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
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await odistsApi.getPage({
        page, pageSize, columns: visibleColumns, filters: appliedFilters, sortBy, sortDir,
      });
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, pageSize, visibleColumns.join(","), JSON.stringify(appliedFilters), sortBy, sortDir]);

  const metadata = data?.columns || [];
  const metadataMap = useMemo(() => new Map(metadata.map((column) => [column.name, column])), [metadata]);
  const filteredFields = metadata.filter((column) => column.name.toLowerCase().includes(fieldSearch.toLowerCase()));

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

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    const initial: Record<string, unknown> = {};
    visibleColumns.forEach((name) => {
      if (metadataMap.get(name)?.editable) initial[name] = row[name] ?? "";
    });
    setEditValues(initial);
  };

  const saveEdit = async () => {
    if (!editing || editing.id === undefined) return;
    const changed: Record<string, unknown> = {};
    Object.entries(editValues).forEach(([key, value]) => {
      const normalized = value === "" ? null : value;
      if (normalized !== (editing[key] ?? null)) changed[key] = normalized;
    });
    if (!Object.keys(changed).length) { setEditing(null); return; }
    setSaving(true);
    setError("");
    try {
      await odistsApi.update(Number(editing.id), changed);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update gagal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ODIST Parsing</h1>
          <p className="text-sm text-muted-foreground">Server-side filter, pagination, sorting, dan audit perubahan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFields((value) => !value)}>Field List</Button>
          <Button variant="outline" onClick={() => void load()}>Refresh</Button>
        </div>
      </div>

      {showFields && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pilih Kolom</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Cari nama field..." value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-auto">
              {filteredFields.map((column) => (
                <label key={column.name} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={visibleColumns.includes(column.name)} disabled={column.name === "id"} onChange={() => toggleColumn(column.name)} />
                  {column.name}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <Button onClick={() => { setPage(1); setAppliedFilters(filters); }}>Terapkan Filter</Button>
            <Button variant="outline" onClick={() => { setFilters({}); setAppliedFilters({}); setPage(1); }}>Reset Filter</Button>
            <label className="text-sm ml-auto">Rows
              <select className="ml-2 border rounded px-2 py-2 bg-background" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
                {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="overflow-auto border rounded-md max-h-[68vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-background z-10">
                <tr>
                  <th className="border-b p-2 text-left min-w-20">Action</th>
                  {visibleColumns.map((name) => (
                    <th key={name} className="border-b p-2 text-left min-w-36 align-top">
                      <button className="font-semibold" onClick={() => toggleSort(name)}>
                        {name}{sortBy === name ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                      </button>
                      <Input className="mt-2 h-8 font-normal" placeholder="Filter..." value={filters[name] || ""} onChange={(e) => setFilters((current) => ({ ...current, [name]: e.target.value }))} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="p-6 text-center" colSpan={visibleColumns.length + 1}>Memuat data...</td></tr>
                ) : data?.items.length ? data.items.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-muted/40">
                    <td className="border-b p-2"><Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button></td>
                    {visibleColumns.map((name) => <td key={name} className="border-b p-2 align-top whitespace-nowrap" title={row[name] == null ? "NULL" : String(row[name])}>{displayValue(row[name])}</td>)}
                  </tr>
                )) : (
                  <tr><td className="p-6 text-center" colSpan={visibleColumns.length + 1}>Tidak ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Total {data?.total ?? 0} row</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span>Page {data?.page ?? page} / {data?.total_pages ?? 1}</span>
              <Button variant="outline" size="sm" disabled={page >= (data?.total_pages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
            <CardHeader><CardTitle>Edit ODIST ID {String(editing.id)}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(editValues).map((name) => (
                  <div key={name} className="space-y-1">
                    <Label>{name}</Label>
                    <Input value={editValues[name] == null ? "" : String(editValues[name])} onChange={(e) => setEditValues((current) => ({ ...current, [name]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Batal</Button>
                <Button onClick={() => void saveEdit()} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

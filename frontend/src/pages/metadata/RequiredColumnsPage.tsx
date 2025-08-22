// src/pages/metadata/RequiredColumnsPage.tsx
import { useState, useEffect } from "react";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/common/DataTable";
import { MetadataListFilter } from "@/components/common/MetadataListFilter";
import { BatchEditMetadata } from "@/components/common/BatchAddMetadata";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { requiredColumnApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { RequiredColumn, FilterOptions } from "@/types";

function normalizeOptions(opts: { value?: string | number; label?: string }[]) {
  return (opts || [])
    .map((o) => {
      const value =
        o.value === undefined || o.value === null ? "" : String(o.value);
      const label = (o.label ?? "").toString();
      return { value, label };
    })
    .filter((o) => o.value !== ""); // drop empty values to satisfy Radix Select
}

const RequiredColumnsPage = () => {
  const [requiredColumns, setRequiredColumns] = useState<RequiredColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // client id -> client_schema map for display
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // tabs
  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<RequiredColumn | null>(null);
  const [editForm, setEditForm] = useState({
    client_id: 0,
    column_name: "",
    logical_source_file: "",
  });

  // delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<RequiredColumn | null>(null);
  const [deleting, setDeleting] = useState(false);

  // initial load and reload when client filter changes (server-side filter)
  useEffect(() => {
    loadData((filters as any).clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadData = async (clientId?: number) => {
    try {
      setLoading(true);
      const resp = await requiredColumnApi.getAll(clientId);
      setRequiredColumns(resp?.data ?? []);

      // load client references for mapping & options
      const clientsResp = await clientReferenceApi.getAll();
      const map: Record<number, string> = {};
      const optsRaw: { value: string; label: string }[] = [];
      (clientsResp?.data ?? []).forEach((c: any) => {
        if (typeof c.client_id === "number") {
          const label = c.client_schema ?? c.client_name ?? String(c.client_id);
          map[c.client_id] = label;
          optsRaw.push({ value: String(c.client_id), label });
        }
      });
      const normalized = normalizeOptions(optsRaw);
      normalized.sort((a, b) => a.label.localeCompare(b.label));
      setClientMap(map);
      setClientOptions(normalized);
    } catch (err) {
      console.error("Failed to load required columns/clients", err);
      toast({
        title: "Error",
        description: "Failed to load required columns",
        variant: "destructive",
      });
      setRequiredColumns([]);
      setClientMap({});
      setClientOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // open edit dialog
  const openEdit = (r: RequiredColumn) => {
    setEditing(r);
    setEditForm({
      client_id: r.client_id,
      column_name: r.column_name,
      logical_source_file: r.logical_source_file ?? "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    if (!editForm.client_id || !editForm.column_name) {
      toast({
        title: "Validation Error",
        description: "Please fill required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const payload: Partial<Omit<RequiredColumn, "required_id">> = {
        client_id: editForm.client_id,
        column_name: editForm.column_name,
        logical_source_file: editForm.logical_source_file || undefined,
      };
      await requiredColumnApi.update(editing.required_id, payload);
      toast({ title: "Success", description: "Required column updated" });
      setIsEditOpen(false);
      setEditing(null);
      loadData((filters as any).clientId);
    } catch (err) {
      console.error("update error", err);
      toast({
        title: "Error",
        description: "Failed to update required column",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (r: RequiredColumn) => {
    setToDelete(r);
    setDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await requiredColumnApi.delete(toDelete.required_id);
      toast({ title: "Deleted", description: "Required column deleted" });
      setDeleteOpen(false);
      setToDelete(null);
      loadData((filters as any).clientId);
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete required column",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Batch save callback from BatchEditMetadata
  const handleBatchSave = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      toast({
        title: "Error",
        description: "No rows to save",
        variant: "destructive",
      });
      return;
    }

    // convert client_id strings to numbers if needed
    const prepared = rows.map((r) => {
      const copy = { ...r };
      if (copy.client_id !== undefined && typeof copy.client_id === "string") {
        const n = Number(copy.client_id);
        if (!Number.isNaN(n)) copy.client_id = n;
      }
      return copy;
    });

    const bad = prepared.some(
      (r) => !r.client_id || !r.column_name || !r.logical_source_file
    );
    if (bad) {
      toast({
        title: "Error",
        description:
          "Each row must include client, column_name and logical_source_file",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      // Backend expected to accept array of required columns
      await requiredColumnApi.batchSave(prepared);
      toast({
        title: "Success",
        description: `${rows.length} required columns saved`,
      });
      setActiveTab("view");
      loadData((filters as any).clientId);
    } catch (err) {
      console.error("batch save error", err);
      toast({
        title: "Error",
        description: "Failed to save required columns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // client-side filtering for logical_source_file (server already filtered by clientId when loaded)
  const logicalFilter =
    (filters as any).logicalSourceFile?.toString().trim().toLowerCase() || "";
  const displayed = requiredColumns
    .map((r) => ({
      ...r,
      client_schema: clientMap[r.client_id] ?? String(r.client_id),
    }))
    .filter((r) => {
      if (logicalFilter) {
        const v = (r.logical_source_file ?? "").toString().toLowerCase();
        if (!v.includes(logicalFilter)) return false;
      }
      return true;
    });

  const columns = [
    { key: "client_schema", label: "Client Schema", sortable: true },
    { key: "column_name", label: "Column Name", sortable: true },
    {
      key: "logical_source_file",
      label: "Logical Source File",
      sortable: true,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: RequiredColumn & { client_schema?: string }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirmDelete(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const batchFields = [
    {
      name: "client_id",
      label: "Client",
      type: "select" as const,
      required: true,
      placeholder: "Select client",
    },
    {
      name: "column_name",
      label: "Column Name",
      type: "text" as const,
      required: true,
      placeholder: "email",
    },
    {
      name: "logical_source_file",
      label: "Source File",
      type: "text" as const,
      required: true,
      placeholder: "customer_data.csv",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Required Columns</h1>
        <p className="text-muted-foreground">
          Define mandatory columns that must be present in source data files
        </p>
      </div>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Edit Required Column #${editing.required_id}`
                : "Edit Required Column"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={String(editForm.client_id || "")}
                  onValueChange={(val) => {
                    if (val === "__no_clients__") return;
                    setEditForm((prev) => ({
                      ...prev,
                      client_id: val === "" ? 0 : Number(val),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientOptions.length === 0 ? (
                      <SelectItem value="__no_clients__" disabled>
                        No registered clients
                      </SelectItem>
                    ) : (
                      clientOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Column Name</Label>
                <Input
                  value={editForm.column_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      column_name: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Logical Source File</Label>
                <Input
                  value={editForm.logical_source_file}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      logical_source_file: e.target.value,
                    }))
                  }
                  placeholder="file.csv"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="interactive-button">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
          setDeleteOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-sm bg-background">
          <DialogHeader>
            <DialogTitle>Delete Required Column</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>Are you sure you want to delete this required column?</p>
            <p className="mt-3 font-medium">
              {toDelete
                ? `#${toDelete.required_id} — ${toDelete.column_name}`
                : ""}
            </p>
          </div>

          <DialogFooter>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={performDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "view" | "batch")}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="view">View Required Columns</TabsTrigger>
          <TabsTrigger value="batch">Batch Add</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-6">
          <MetadataListFilter
            onFiltersChange={setFilters}
            loading={loading}
            showVersionFilter={false}
            showStatusFilter={false}
            showBatchFilter={false}
            // we rely on MetadataListFilter to set filters.logicalSourceFile
            showLogicalFilter={false}
          />

          <Card className="professional-card">
            <CardContent className="p-0">
              <DataTable
                data={displayed}
                columns={columns}
                loading={loading}
                searchPlaceholder="Search required columns..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchEditMetadata
            title="Required Columns"
            fields={batchFields}
            initialData={[]}
            fieldOptions={{ client_id: { options: clientOptions } }}
            onSave={async (rows) => await handleBatchSave(rows)}
            loading={loading}
            onSaved={() => {
              setActiveTab("view");
              loadData((filters as any).clientId);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequiredColumnsPage;

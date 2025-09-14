// src/pages/metadata/ConfigPage.tsx
import { useState, useEffect } from "react";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { clientConfigApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { ClientConfig, FilterOptions } from "@/types";

const MAX_SOURCE_CONFIG_LENGTH = 160;

function renderSourceConfigPreview(obj: any) {
  if (obj === null || obj === undefined) return "";
  try {
    const s = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    if (s.length <= MAX_SOURCE_CONFIG_LENGTH) return s;
    return s.slice(0, MAX_SOURCE_CONFIG_LENGTH) + "…";
  } catch {
    return String(obj);
  }
}

/** helper: ensure options have non-empty string values and label fallback */
function normalizeOptions(opts: { value?: string | number; label?: string }[]) {
  return (opts || [])
    .map((o) => {
      const value =
        o.value === undefined || o.value === null ? "" : String(o.value);
      const label = (o.label ?? "").toString();
      return { value, label };
    })
    .filter((o) => o.value !== ""); // drop empty values
}

const ConfigPage = () => {
  const [configs, setConfigs] = useState<ClientConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // client_id -> client_schema map (for display)
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  // client options for selects (value is string of client_id)
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ClientConfig | null>(null);
  const [editForm, setEditForm] = useState({
    client_id: 0,
    source_type: "",
    source_system: "",
    target_schema: "",
    target_table: "",
    source_config: "",
    is_active: true,
    logical_source_file: "",
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<ClientConfig | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // Reload when filters change (backend will use filters.clientId if present)
  useEffect(() => {
    loadConfigs((filters as any).clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadConfigs = async (clientId?: number) => {
    try {
      setLoading(true);
      const resp = await clientConfigApi.getAll(clientId);
      setConfigs(resp?.data ?? []);

      // load clients for mapping and options
      const clientsResp = await clientReferenceApi.getAll();
      const map: Record<number, string> = {};
      const optsRaw: { value: string; label: string }[] = [];
      (clientsResp?.data ?? []).forEach((c) => {
        if (typeof c.client_id === "number") {
          const label = c.client_schema ?? c.client_name ?? String(c.client_id);
          map[c.client_id] = label;
          optsRaw.push({ value: String(c.client_id), label });
        }
      });

      const normalized = normalizeOptions(optsRaw);
      // sort by label for UX
      normalized.sort((a, b) => a.label.localeCompare(b.label));
      setClientMap(map);
      setClientOptions(normalized);
    } catch (err) {
      console.error("Failed to load configs/clients", err);
      toast({
        title: "Error",
        description: "Failed to load configurations",
        variant: "destructive",
      });
      setConfigs([]);
      setClientMap({});
      setClientOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (cfg: ClientConfig) => {
    setEditingConfig(cfg);
    setEditForm({
      client_id: cfg.client_id,
      source_type: cfg.source_type,
      source_system: (cfg as any).source_system ?? "",
      target_schema: cfg.target_schema,
      target_table: cfg.target_table,
      source_config: cfg.source_config
        ? JSON.stringify(cfg.source_config, null, 2)
        : "",
      is_active: cfg.is_active ?? true,
      logical_source_file: cfg.logical_source_file ?? "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;

    if (
      !editForm.client_id ||
      !editForm.source_type ||
      !editForm.target_schema ||
      !editForm.target_table
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill required fields",
        variant: "destructive",
      });
      return;
    }

    // parse source_config JSON if present
    let parsedSourceConfig: any = undefined;
    if (editForm.source_config && editForm.source_config.trim() !== "") {
      try {
        parsedSourceConfig = JSON.parse(editForm.source_config);
      } catch (err) {
        toast({
          title: "Invalid JSON",
          description: "source_config must be valid JSON",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setLoading(true);
      const payload: Partial<Omit<ClientConfig, "config_id">> = {
        client_id: editForm.client_id,
        source_type: editForm.source_type,
        source_system: editForm.source_system || undefined,
        target_schema: editForm.target_schema,
        target_table: editForm.target_table,
        source_config: parsedSourceConfig,
        is_active: editForm.is_active,
        logical_source_file: editForm.logical_source_file || undefined,
      };
      await clientConfigApi.update(editingConfig.config_id, payload);
      toast({ title: "Success", description: "Configuration updated" });
      setIsEditOpen(false);
      setEditingConfig(null);
      loadConfigs((filters as any).clientId);
    } catch (err) {
      console.error("update error", err);
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (cfg: ClientConfig) => {
    setConfigToDelete(cfg);
    setDeleteDialogOpen(true);
  };

  const performDelete = async () => {
    if (!configToDelete) return;
    try {
      setDeleting(true);
      await clientConfigApi.delete(configToDelete.config_id);
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast({ title: "Deleted", description: "Configuration deleted" });
      loadConfigs((filters as any).clientId);
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchSave = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      toast({
        title: "Error",
        description: "No rows to save",
        variant: "destructive",
      });
      return;
    }

    // rows from BatchEditMetadata should already have client_id converted when fieldOptions provided,
    // but double-check for safety: convert numeric-strings to numbers.
    const prepared = rows.map((r) => {
      const copy = { ...r };
      if (copy.client_id !== undefined && typeof copy.client_id === "string") {
        const n = Number(copy.client_id);
        if (!Number.isNaN(n)) copy.client_id = n;
      }
      return copy;
    });

    const bad = prepared.some(
      (r) =>
        !r.client_id || !r.source_type || !r.target_schema || !r.target_table
    );
    if (bad) {
      toast({
        title: "Error",
        description:
          "Each row must include client, source_type, target_schema, target_table",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await clientConfigApi.batchSave(
        prepared as Array<Omit<ClientConfig, "config_id">>
      );
      toast({
        title: "Success",
        description: `${rows.length} configurations saved`,
      });
      setActiveTab("view");
      loadConfigs((filters as any).clientId);
    } catch (err) {
      console.error("batch save error", err);
      toast({
        title: "Error",
        description: "Failed to save configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle active/inactive with optimistic UI update
  const handleToggleActive = async (cfg: ClientConfig) => {
    // optimistic update
    setConfigs((prev) =>
      prev.map((item) =>
        item.config_id === cfg.config_id
          ? { ...item, is_active: !item.is_active }
          : item
      )
    );
    try {
      await clientConfigApi.update(cfg.config_id, {
        is_active: !cfg.is_active,
      });
      toast({
        title: "Success",
        description: `Configuration ${
          !cfg.is_active ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      // revert on error
      setConfigs((prev) =>
        prev.map((item) =>
          item.config_id === cfg.config_id
            ? { ...item, is_active: cfg.is_active }
            : item
        )
      );
      console.error("toggle active error", err);
      toast({
        title: "Error",
        description: "Failed to update configuration status",
        variant: "destructive",
      });
    }
  };

  // Map configs to include client_schema for display
  const mappedConfigs = configs.map((c) => ({
    ...c,
    client_schema: clientMap[c.client_id] ?? String(c.client_id),
  }));

  // Apply filters (status: 'active'|'inactive' from MetadataListFilter, clientId handled server-side)
  const statusFilter = (filters as any).status as string | undefined;
  const logicalFilter =
    (filters as any).logicalSourceFile?.toString().trim().toLowerCase() || "";

  const displayedConfigs = mappedConfigs.filter((cfg) => {
    if (statusFilter) {
      const isActive = statusFilter === "active";
      if ((cfg.is_active ?? false) !== isActive) return false;
    }

    if (logicalFilter) {
      const v = (cfg.logical_source_file ?? "").toString().toLowerCase();
      if (!v.includes(logicalFilter)) return false;
    }

    return true;
  });

  const columns = [
    { key: "client_schema", label: "Client Schema", sortable: true },
    { key: "target_schema", label: "Target Schema", sortable: true },
    { key: "target_table", label: "Target Table", sortable: true },
    { key: "source_type", label: "Source Type", sortable: true },
    { key: "source_system", label: "Source System", sortable: true },
    {
      key: "logical_source_file",
      label: "Logical Source File",
      sortable: true,
    },
    {
      key: "source_config",
      label: "Source Config",
      sortable: false,
      render: (_: any, cfg: ClientConfig) => {
        const preview = renderSourceConfigPreview(cfg.source_config);
        return (
          <div className="max-w-xs text-xs whitespace-pre-wrap break-words text-muted-foreground">
            {preview || <span className="text-muted-foreground">—</span>}
          </div>
        );
      },
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (_: any, cfg: ClientConfig) => (
        <div className="flex items-center gap-3">
          <Badge
            variant={cfg.is_active ?? false ? "default" : "secondary"}
            className={
              cfg.is_active ?? false
                ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
            }
          >
            {cfg.is_active ?? false ? "Active" : "Inactive"}
          </Badge>

          <Switch
            checked={!!cfg.is_active}
            onCheckedChange={() => handleToggleActive(cfg)}
          />
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, cfg: ClientConfig & { client_schema?: string }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(cfg)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirmDelete(cfg)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="h-full w-full p-6 space-y-6 flex flex-col overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Client Configurations
          </h1>
          <p className="text-muted-foreground">
            Manage client configuration and batch entries
          </p>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg bg-background">
          <DialogHeader>
            <DialogTitle>
              {editingConfig
                ? `Edit Config #${editingConfig.config_id}`
                : "Edit Config"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={String(editForm.client_id || "")}
                  onValueChange={(val) => {
                    // ignore "no clients" sentinel if selected (shouldn't be selectable if disabled)
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
                      // Non-empty value (Radix requires non-empty), disabled so it can't be selected
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
                <Label>Source Type</Label>
                <Input
                  value={editForm.source_type}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      source_type: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Source System</Label>
                <Input
                  value={editForm.source_system}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      source_system: e.target.value,
                    }))
                  }
                  placeholder="system_x"
                />
              </div>

              <div className="space-y-2">
                <Label>Target Schema</Label>
                <Input
                  value={editForm.target_schema}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      target_schema: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Target Table</Label>
                <Input
                  value={editForm.target_table}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      target_table: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source Config (JSON)</Label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={6}
                value={editForm.source_config}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    source_config: e.target.value,
                  }))
                }
                placeholder='{"key":"value"}'
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label>Active</Label>
                <div className="flex items-center">
                  <Switch
                    checked={!!editForm.is_active}
                    onCheckedChange={(val) =>
                      setEditForm((prev) => ({ ...prev, is_active: !!val }))
                    }
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {editForm.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
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
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) setConfigToDelete(null);
          setDeleteDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Delete Configuration</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>Are you sure you want to delete this configuration?</p>
            <p className="mt-3 font-medium">
              {configToDelete
                ? `#${configToDelete.config_id} — ${configToDelete.target_table}`
                : ""}
            </p>
          </div>

          <DialogFooter>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
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
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="batch">New</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-6">
          <MetadataListFilter
            onFiltersChange={setFilters}
            loading={loading}
            showVersionFilter={false}
            showStatusFilter={true}
            statusFilterType="active-inactive"
            showBatchFilter={false}
          />

          <Card className="professional-card">
            <CardContent className="p-0">
              <DataTable
                data={displayedConfigs}
                columns={columns}
                loading={loading}
                searchPlaceholder="Search configs..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchEditMetadata
            title=""
            fields={[
              {
                name: "client_id",
                label: "Client",
                type: "select",
                required: true,
                placeholder: "Select client",
              },
              {
                name: "source_type",
                label: "Source Type",
                type: "text",
                required: true,
                placeholder: "csv",
              },
              {
                name: "source_system",
                label: "Source System",
                type: "text",
                required: false,
                placeholder: "system_x",
              },
              {
                name: "target_schema",
                label: "Target Schema",
                type: "text",
                required: true,
                placeholder: "schema_x",
              },
              {
                name: "target_table",
                label: "Target Table",
                type: "text",
                required: true,
                placeholder: "table_x",
              },
              {
                name: "source_config",
                label: "Source Config (JSON)",
                type: "text",
                required: false,
                placeholder: '{"key":"value"}',
              },
              {
                name: "is_active",
                label: "Active",
                type: "switch",
                required: false,
              },
              {
                name: "logical_source_file",
                label: "Logical File",
                type: "text",
                required: false,
                placeholder: "file.csv",
              },
            ]}
            initialData={[]}
            fieldOptions={{
              client_id: { options: clientOptions },
            }}
            onSave={async (data: any[]) => {
              await handleBatchSave(data);
            }}
            loading={loading}
            onSaved={() => {
              setActiveTab("view");
              loadConfigs((filters as any).clientId);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigPage;

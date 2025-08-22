// src/pages/metadata/IntegrationsPage.tsx
import { useState, useEffect } from "react";
import { Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { integrationConfigApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IntegrationConfig, FilterOptions } from "@/types";

const integrationConfigSchema = z.object({
  client_id: z.number().min(1, "Client is required"),
  proc_name: z.string().min(1, "Procedure Name is required"),
  is_active: z.boolean(),
  table_type: z.string().optional(),
  run_order: z.number().optional(),
});
type IntegrationConfigFormData = z.infer<typeof integrationConfigSchema>;

function normalizeOptions(opts: { value?: string | number; label?: string }[]) {
  return (opts || [])
    .map((o) => {
      const value =
        o.value === undefined || o.value === null ? "" : String(o.value);
      const label = (o.label ?? "").toString();
      return { value, label };
    })
    .filter((o) => o.value !== "");
}

const IntegrationsPage = () => {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // client refs
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // tabs
  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationConfig | null>(null);

  // delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<IntegrationConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // form
  const form = useForm<IntegrationConfigFormData>({
    resolver: zodResolver(integrationConfigSchema),
    defaultValues: {
      client_id: 0,
      proc_name: "",
      is_active: true,
      table_type: "",
      run_order: undefined,
    },
  });

  // initial load + reload when filters change
  useEffect(() => {
    loadAll((filters as any).clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadAll = async (clientId?: number) => {
    try {
      setLoading(true);
      const resp = await integrationConfigApi.getAll(clientId);
      setIntegrations(resp?.data ?? []);

      // load clients for select + map
      try {
        const clientsResp = await clientReferenceApi.getAll();
        const map: Record<number, string> = {};
        const optsRaw: { value: string; label: string }[] = [];
        (clientsResp?.data ?? []).forEach((c: any) => {
          if (typeof c.client_id === "number") {
            const label =
              c.client_schema ?? c.client_name ?? String(c.client_id);
            map[c.client_id] = label;
            optsRaw.push({ value: String(c.client_id), label });
          }
        });
        const normalized = normalizeOptions(optsRaw);
        normalized.sort((a, b) => a.label.localeCompare(b.label));
        setClientMap(map);
        setClientOptions(normalized);
      } catch (err) {
        console.error("failed loading client refs", err);
        setClientMap({});
        setClientOptions([]);
      }
    } catch (err) {
      console.error("load integrations error", err);
      toast({
        title: "Error",
        description: "Failed to load integration configurations",
        variant: "destructive",
      });
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  // open edit dialog (prefill form)
  const openEdit = (cfg: IntegrationConfig) => {
    setEditing(cfg);
    form.reset({
      client_id: cfg.client_id,
      proc_name: cfg.proc_name,
      is_active: !!cfg.is_active,
      table_type: cfg.table_type ?? "",
      run_order: cfg.run_order ?? undefined,
    });
    setIsEditOpen(true);
  };

  // submit create/update
  const handleEditSubmit = async (data: IntegrationConfigFormData) => {
    try {
      setLoading(true);
      if (editing) {
        const payload: Partial<
          Omit<
            IntegrationConfig,
            "integration_id" | "created_at" | "created_by"
          >
        > = {
          client_id: data.client_id,
          proc_name: data.proc_name,
          is_active: data.is_active,
          table_type: data.table_type || undefined,
          run_order: data.run_order === undefined ? undefined : data.run_order,
        };
        await integrationConfigApi.update(editing.integration_id, payload);
        toast({
          title: "Success",
          description: "Integration configuration updated",
        });
      } else {
        const payload: Omit<
          IntegrationConfig,
          "integration_id" | "created_at" | "created_by"
        > = {
          client_id: data.client_id,
          proc_name: data.proc_name,
          is_active: data.is_active,
          table_type: data.table_type || undefined,
          run_order: data.run_order === undefined ? undefined : data.run_order,
        };
        await integrationConfigApi.create(payload);
        toast({
          title: "Success",
          description: "Integration configuration created",
        });
      }

      setIsEditOpen(false);
      setEditing(null);
      form.reset();
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("submit error", err);
      toast({
        title: "Error",
        description: `Failed to ${
          editing ? "update" : "create"
        } integration configuration`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // delete flow
  const confirmDelete = (cfg: IntegrationConfig) => {
    setToDelete(cfg);
    setDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await integrationConfigApi.delete(toDelete.integration_id);
      toast({
        title: "Deleted",
        description: "Integration configuration deleted",
      });
      setDeleteOpen(false);
      setToDelete(null);
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete integration configuration",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // toggle active (optimistic)
  const handleToggleActive = async (cfg: IntegrationConfig) => {
    const prev = integrations;
    setIntegrations((p) =>
      p.map((t) =>
        t.integration_id === cfg.integration_id
          ? { ...t, is_active: !t.is_active }
          : t
      )
    );
    try {
      await integrationConfigApi.update(cfg.integration_id, {
        is_active: !cfg.is_active,
      });
      toast({
        title: "Success",
        description: `Integration configuration ${
          !cfg.is_active ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      setIntegrations(prev);
      console.error("toggle active error", err);
      toast({
        title: "Error",
        description: "Failed to update integration configuration status",
        variant: "destructive",
      });
    }
  };

  // batch save
  const handleBatchSave = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      toast({
        title: "Error",
        description: "No rows to save",
        variant: "destructive",
      });
      return;
    }

    const prepared = rows.map((r) => {
      const copy = { ...r };
      if (copy.client_id !== undefined && typeof copy.client_id === "string") {
        const n = Number(copy.client_id);
        if (!Number.isNaN(n)) copy.client_id = n;
      }
      if (copy.is_active === undefined) copy.is_active = true;
      return copy;
    });

    const invalid = prepared.some((r) => !r.client_id || !r.proc_name);
    if (invalid) {
      toast({
        title: "Error",
        description: "Each row must include client and proc_name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await integrationConfigApi.batchSave(prepared);
      toast({
        title: "Success",
        description: `${rows.length} integration configs saved`,
      });
      setActiveTab("view");
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("batch save error", err);
      toast({
        title: "Error",
        description: "Failed to save integration configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // client-side status filter only
  const statusFilter = (filters as any).status as string | undefined;
  const displayed = integrations
    .map((t) => ({
      ...t,
      client_schema: clientMap[t.client_id] ?? String(t.client_id),
    }))
    .filter((t) => {
      if (statusFilter) {
        const isActive = statusFilter === "active";
        if ((t.is_active ?? false) !== isActive) return false;
      }
      return true;
    });

  const columns = [
    { key: "client_schema", label: "Client Schema", sortable: true },
    { key: "proc_name", label: "Procedure Name", sortable: true },
    { key: "table_type", label: "Table Type", sortable: true },
    { key: "run_order", label: "Run Order", sortable: true },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (_: any, row: IntegrationConfig) => (
        <div className="flex items-center gap-2">
          <span
            className={
              row.is_active
                ? "inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                : "inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
            }
          >
            {row.is_active ? "Active" : "Inactive"}
          </span>
          <Switch
            checked={!!row.is_active}
            onCheckedChange={() => handleToggleActive(row)}
          />
        </div>
      ),
    },
    { key: "created_by", label: "Created By", sortable: true },
    { key: "created_at", label: "Created At", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: IntegrationConfig) => (
        <div className="flex items-center gap-2">
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
      name: "proc_name",
      label: "Procedure Name",
      type: "text" as const,
      required: true,
      placeholder: "proc_transform_x",
    },
    {
      name: "table_type",
      label: "Table Type",
      type: "select" as const,
      required: false,
      placeholder: "Select type",
      options: [
        { value: "dimension", label: "Dimension" },
        { value: "fact", label: "Fact" },
      ],
    },
    {
      name: "run_order",
      label: "Run Order",
      type: "number" as const,
      required: false,
      placeholder: "1",
    },
    {
      name: "is_active",
      label: "Active",
      type: "switch" as const,
      required: false,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Integration Configurations
          </h1>
          <p className="text-muted-foreground">
            Manage integration procedure configurations
          </p>
        </div>

        {/* Add button opens dialog */}
        <div>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-md bg-background">
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? `Edit Integration #${editing.integration_id}`
                    : "Add New Integration Configuration"}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={form.handleSubmit(handleEditSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select
                      value={String(form.getValues().client_id || "")}
                      onValueChange={(v) => {
                        if (v === "__no_clients__") return;
                        form.setValue("client_id", v === "" ? 0 : Number(v));
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
                    <Label>Procedure Name</Label>
                    <Input
                      {...form.register("proc_name")}
                      placeholder="Enter procedure name for integration"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Table Type</Label>
                    <Select
                      value={String(form.getValues().table_type ?? "")}
                      onValueChange={(v) =>
                        form.setValue("table_type", v === "" ? undefined : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select table type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Select</SelectItem>
                        <SelectItem value="dimension">Dimension</SelectItem>
                        <SelectItem value="fact">Fact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Run Order</Label>
                    <Input
                      type="number"
                      value={form.getValues().run_order ?? ""}
                      onChange={(e) =>
                        form.setValue(
                          "run_order",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      placeholder="Enter run order"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Active</Label>
                    <div className="flex items-center">
                      <Switch
                        checked={form.watch("is_active")}
                        onCheckedChange={(v) => form.setValue("is_active", !!v)}
                      />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {form.watch("is_active") ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setIsEditOpen(false);
                      setEditing(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="interactive-button">
                    {editing ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "view" | "batch")}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="batch">Batch Add</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-6">
          <MetadataListFilter
            onFiltersChange={setFilters}
            loading={loading}
            showStatusFilter={true}
            statusFilterType="active-inactive"
            showVersionFilter={false}
            showBatchFilter={false}
            showDateFilter={false}
          />

          <Card className="professional-card">
            <CardContent className="p-0">
              <DataTable data={displayed} columns={columns} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchEditMetadata
            title="Integration Configs (Batch)"
            fields={batchFields}
            initialData={[]}
            fieldOptions={{ client_id: { options: clientOptions } }}
            onSave={async (rows) => await handleBatchSave(rows)}
            loading={loading}
            onSaved={async () => {
              setActiveTab("view");
              await loadAll((filters as any).clientId);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog (standardized) */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
          setDeleteOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-sm bg-background">
          <DialogHeader>
            <DialogTitle>Delete Integration Configuration</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>
              Are you sure you want to delete this integration configuration?
            </p>
            <p className="mt-3 font-medium">
              {toDelete
                ? `#${toDelete.integration_id} — ${toDelete.proc_name}`
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
    </div>
  );
};

export default IntegrationsPage;

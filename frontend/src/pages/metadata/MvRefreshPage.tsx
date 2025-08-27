// src/pages/metadata/MvRefreshPage.tsx
import { useState, useEffect } from "react";
import { Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import { mvRefreshConfigApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { MvRefreshConfig, FilterOptions } from "@/types";

const mvConfigSchema = z.object({
  client_id: z.number().min(1, "Client is required"),
  mv_proc_name: z.string().min(1, "MV Procedure Name is required"),
  is_active: z.boolean(),
  refresh_mode: z.string().optional(),
});
type MvConfigFormData = z.infer<typeof mvConfigSchema>;

/** Normalize options (ensure non-empty string value for Radix Select) */
function normalizeOptions(opts: { value?: string | number; label?: string }[]) {
  return (opts || [])
    .map((o) => {
      const value =
        o.value === undefined || o.value === null ? "" : String(o.value);
      const label = (o.label ?? "").toString();
      return { value, label };
    })
    .filter((o) => o.value !== ""); // drop empty values so Radix Select placeholder works
}

const MvRefreshPage = () => {
  const [mvConfigs, setMvConfigs] = useState<MvRefreshConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // client refs for select + mapping
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // tabs
  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<MvRefreshConfig | null>(null);

  // delete dialog (standardized)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MvRefreshConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // form
  const form = useForm<MvConfigFormData>({
    resolver: zodResolver(mvConfigSchema),
    defaultValues: {
      client_id: 0,
      mv_proc_name: "",
      is_active: true,
      refresh_mode: "manual",
    },
  });

  // initial load + reload when filters change (server-side client filter supported)
  useEffect(() => {
    loadAll((filters as any).clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadAll = async (clientId?: number) => {
    try {
      setLoading(true);
      const resp = await mvRefreshConfigApi.getAll(clientId);
      setMvConfigs(resp?.data ?? []);

      // load client refs for selects & mapping
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
      console.error("load mv refresh configs error", err);
      toast({
        title: "Error",
        description: "Failed to load MV refresh configurations",
        variant: "destructive",
      });
      setMvConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  // open edit dialog (prefill form)
  const openEdit = (cfg: MvRefreshConfig) => {
    setEditing(cfg);
    form.reset({
      client_id: cfg.client_id,
      mv_proc_name: cfg.mv_proc_name,
      is_active: !!cfg.is_active,
      refresh_mode: cfg.refresh_mode ?? "manual",
    });
    setIsEditOpen(true);
  };

  // submit create / update
  const handleEditSubmit = async (data: MvConfigFormData) => {
    try {
      setLoading(true);
      if (editing) {
        const payload: Partial<
          Omit<MvRefreshConfig, "mv_id" | "created_at" | "created_by">
        > = {
          client_id: data.client_id,
          mv_proc_name: data.mv_proc_name,
          is_active: data.is_active,
          refresh_mode: data.refresh_mode || undefined,
        };
        await mvRefreshConfigApi.update(editing.mv_id, payload);
        toast({ title: "Success", description: "MV configuration updated" });
      } else {
        const payload: Omit<
          MvRefreshConfig,
          "mv_id" | "created_at" | "created_by"
        > = {
          client_id: data.client_id,
          mv_proc_name: data.mv_proc_name,
          is_active: data.is_active,
          refresh_mode: data.refresh_mode || undefined,
        };
        await mvRefreshConfigApi.create(payload);
        toast({ title: "Success", description: "MV configuration created" });
      }

      // close dialog, reset, reload and switch to view
      setIsEditOpen(false);
      setEditing(null);
      form.reset();
      setActiveTab("view");
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("submit error", err);
      toast({
        title: "Error",
        description: `Failed to ${
          editing ? "update" : "create"
        } MV configuration`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // delete flow
  const confirmDelete = (cfg: MvRefreshConfig) => {
    setToDelete(cfg);
    setDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await mvRefreshConfigApi.delete(toDelete.mv_id);
      toast({ title: "Deleted", description: "MV configuration deleted" });
      setDeleteOpen(false);
      setToDelete(null);
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete MV configuration",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // toggle active (optimistic)
  const handleToggleActive = async (cfg: MvRefreshConfig) => {
    const prev = mvConfigs;
    setMvConfigs((p) =>
      p.map((x) =>
        x.mv_id === cfg.mv_id ? { ...x, is_active: !x.is_active } : x
      )
    );
    try {
      await mvRefreshConfigApi.update(cfg.mv_id, { is_active: !cfg.is_active });
      toast({
        title: "Success",
        description: `MV configuration ${
          !cfg.is_active ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      setMvConfigs(prev);
      console.error("toggle active error", err);
      toast({
        title: "Error",
        description: "Failed to update MV configuration status",
        variant: "destructive",
      });
    }
  };

  // Batch save callback (fallback to per-item create if no batch endpoint)
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

    const invalid = prepared.some((r) => !r.client_id || !r.mv_proc_name);
    if (invalid) {
      toast({
        title: "Error",
        description: "Each row must include client and mv_proc_name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // If backend exposes batchSave on api, call it.
      // Otherwise fallback to create each one (parallel).
      const apiAny = mvRefreshConfigApi as any;
      if (typeof apiAny.batchSave === "function") {
        await apiAny.batchSave(prepared);
      } else {
        await Promise.all(
          prepared.map((p) =>
            mvRefreshConfigApi.create({
              client_id: p.client_id,
              mv_proc_name: p.mv_proc_name,
              is_active: p.is_active,
              refresh_mode: p.refresh_mode,
            } as Omit<MvRefreshConfig, "mv_id" | "created_at" | "created_by">)
          )
        );
      }

      toast({
        title: "Success",
        description: `${rows.length} MV refresh configs saved`,
      });
      setActiveTab("view");
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("batch save error", err);
      toast({
        title: "Error",
        description: "Failed to save MV refresh configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // apply client + status + refreshMode filters client-side (server already filters by clientId when loaded)
  const statusFilter = (filters as any).status as string | undefined;
  const refreshModeFilter = (filters as any).refreshMode as string | undefined;
  const displayed = mvConfigs
    .map((t) => ({
      ...t,
      client_schema: clientMap[t.client_id] ?? String(t.client_id),
    }))
    .filter((t) => {
      if (statusFilter) {
        const isActive = statusFilter === "active";
        if ((t.is_active ?? false) !== isActive) return false;
      }
      if (refreshModeFilter && t.refresh_mode !== refreshModeFilter)
        return false;
      return true;
    });

  const columns = [
    { key: "mv_id", label: "ID", sortable: true },
    { key: "client_schema", label: "Client Schema", sortable: true },
    { key: "mv_proc_name", label: "MV Procedure Name", sortable: true },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (_: any, row: MvRefreshConfig) => (
        <div className="flex items-center gap-2">
          <Badge
            variant={row.is_active ?? false ? "default" : "secondary"}
            className={
              row.is_active ?? false
                ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
            }
          >
            {row.is_active ?? false ? "Active" : "Inactive"}
          </Badge>
          <Switch
            checked={!!row.is_active}
            onCheckedChange={() => handleToggleActive(row)}
          />
        </div>
      ),
    },
    { key: "refresh_mode", label: "Refresh Mode", sortable: true },
    { key: "created_by", label: "Created By", sortable: true },
    { key: "created_at", label: "Created At", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: MvRefreshConfig) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => confirmDelete(row)}>
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
      name: "mv_proc_name",
      label: "MV Procedure",
      type: "text" as const,
      required: true,
      placeholder: "refresh_sales_mv",
    },
    {
      name: "refresh_mode",
      label: "Refresh Mode",
      type: "select" as const,
      required: false,
      options: [
        { value: "manual", label: "Manual" },
        { value: "automatic", label: "Automatic" },
      ],
    },
    {
      name: "is_active",
      label: "Active",
      type: "switch" as const,
      required: false,
    },
  ];

  return (
    <div className="h-full w-full p-6 space-y-6 flex flex-col overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            MV Refresh Configurations
          </h1>
          <p className="text-muted-foreground">
            Manage materialized view refresh configurations
          </p>
        </div>

        {/* Add button opens the dialog (consistent style) */}
        <div>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-md bg-background">
              <DialogHeader>
                <DialogTitle>
                  {editing
                    ? `Edit MV #${editing.mv_id}`
                    : "Add New MV Configuration"}
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleEditSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <FormControl>
                            <Select
                              value={String(field.value || "")}
                              onValueChange={(v) => {
                                if (v === "__no_clients__") return;
                                field.onChange(v === "" ? 0 : Number(v));
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
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mv_proc_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MV Procedure Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter procedure name for MV refresh"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="refresh_mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Refresh Mode</FormLabel>
                          <FormControl>
                            <Select
                              value={String(field.value ?? "")}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select refresh mode" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="automatic">
                                  Automatic
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div>
                            <FormLabel>Active</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
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
                    <Button type="submit">
                      {editing ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </Form>
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
          <TabsTrigger value="batch">New</TabsTrigger>
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
            showRefreshModeFilter={true}
          />

          <Card className="professional-card">
            <CardContent className="p-0">
              <DataTable data={displayed} columns={columns} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchEditMetadata
            title=""
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
            <DialogTitle>Delete MV Configuration</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>Are you sure you want to delete this MV configuration?</p>
            <p className="mt-3 font-medium">
              {toDelete ? `#${toDelete.mv_id} — ${toDelete.mv_proc_name}` : ""}
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

export default MvRefreshPage;

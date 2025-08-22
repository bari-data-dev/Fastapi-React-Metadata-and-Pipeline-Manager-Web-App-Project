// src/pages/metadata/IntegrationDependenciesPage.tsx
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { integrationDependenciesApi, clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
  IntegrationDependency,
  ClientReference,
  FilterOptions,
} from "@/types";

const integrationDependencySchema = z.object({
  client_id: z.number().min(1, "Client is required"),
  fact_proc_name: z.string().min(1, "Fact procedure is required"),
  dim_proc_name: z.string().min(1, "Dimension procedure is required"),
});
type IntegrationDependencyFormData = z.infer<
  typeof integrationDependencySchema
>;

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

const IntegrationDependenciesPage = () => {
  const [dependencies, setDependencies] = useState<IntegrationDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // client refs for selects & mapping
  const [clientMap, setClientMap] = useState<Record<number, string>>({});
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // tabs (controlled)
  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // edit dialog (create/edit)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationDependency | null>(null);

  // delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<IntegrationDependency | null>(null);
  const [deleting, setDeleting] = useState(false);

  // form
  const form = useForm<IntegrationDependencyFormData>({
    resolver: zodResolver(integrationDependencySchema),
    defaultValues: {
      client_id: 0,
      fact_proc_name: "",
      dim_proc_name: "",
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
      const resp = await integrationDependenciesApi.getAll(clientId);
      setDependencies(resp?.data ?? []);

      // load client refs
      try {
        const clientsResp = await clientReferenceApi.getAll();
        const map: Record<number, string> = {};
        const optsRaw: { value: string; label: string }[] = [];
        (clientsResp?.data ?? []).forEach((c: ClientReference | any) => {
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
        // non-fatal: still show dependencies but client selects will be empty
        console.error("failed loading client refs", err);
        setClientMap({});
        setClientOptions([]);
      }
    } catch (err) {
      console.error("load integration dependencies error", err);
      toast({
        title: "Error",
        description: "Failed to load integration dependencies",
        variant: "destructive",
      });
      setDependencies([]);
    } finally {
      setLoading(false);
    }
  };

  // open edit dialog (prefill form)
  const openEdit = (d: IntegrationDependency) => {
    setEditing(d);
    form.reset({
      client_id: d.client_id,
      fact_proc_name: d.fact_proc_name,
      dim_proc_name: d.dim_proc_name,
    });
    setIsEditOpen(true);
  };

  // submit create/update
  const handleEditSubmit = async (data: IntegrationDependencyFormData) => {
    try {
      setLoading(true);
      if (editing) {
        const payload: Partial<Omit<IntegrationDependency, "dependency_id">> = {
          client_id: data.client_id,
          fact_proc_name: data.fact_proc_name,
          dim_proc_name: data.dim_proc_name,
        };
        await integrationDependenciesApi.update(editing.dependency_id, payload);
        toast({
          title: "Success",
          description: "Integration dependency updated",
        });
      } else {
        const payload: Omit<IntegrationDependency, "dependency_id"> = {
          client_id: data.client_id,
          fact_proc_name: data.fact_proc_name,
          dim_proc_name: data.dim_proc_name,
        };
        await integrationDependenciesApi.create(payload);
        toast({
          title: "Success",
          description: "Integration dependency created",
        });
      }

      // close dialog, reset form, reload and show view tab
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
        } integration dependency`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // delete flow (standardized)
  const confirmDelete = (d: IntegrationDependency) => {
    setToDelete(d);
    setDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await integrationDependenciesApi.delete(toDelete.dependency_id);
      toast({
        title: "Deleted",
        description: "Integration dependency deleted",
      });
      setDeleteOpen(false);
      setToDelete(null);
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete integration dependency",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Batch save callback
  const handleBatchSave = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      toast({
        title: "Error",
        description: "No rows to save",
        variant: "destructive",
      });
      return;
    }

    // prepare rows: convert client_id strings to numbers
    const prepared = rows.map((r) => {
      const copy = { ...r };
      if (copy.client_id !== undefined && typeof copy.client_id === "string") {
        const n = Number(copy.client_id);
        if (!Number.isNaN(n)) copy.client_id = n;
      }
      return copy;
    });

    const invalid = prepared.some(
      (r) => !r.client_id || !r.fact_proc_name || !r.dim_proc_name
    );
    if (invalid) {
      toast({
        title: "Error",
        description:
          "Each row must include client, fact_proc_name and dim_proc_name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await integrationDependenciesApi.batchSave(prepared);
      toast({
        title: "Success",
        description: `${rows.length} integration dependencies saved`,
      });
      setActiveTab("view");
      await loadAll((filters as any).clientId);
    } catch (err) {
      console.error("batch save error", err);
      toast({
        title: "Error",
        description: "Failed to save integration dependencies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // displayed with client_schema
  const displayed = dependencies
    .map((d) => ({
      ...d,
      client_schema: clientMap[d.client_id] ?? String(d.client_id),
    }))
    .filter((d) => {
      // if MetadataListFilter's logical or status filters are used, add client-side filtering here
      return true;
    });

  const columns = [
    { key: "dependency_id", label: "ID", sortable: true },
    { key: "client_schema", label: "Client Schema", sortable: true },
    { key: "fact_proc_name", label: "Fact Procedure", sortable: true },
    { key: "dim_proc_name", label: "Dimension Procedure", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: IntegrationDependency) => (
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
      name: "fact_proc_name",
      label: "Fact Procedure",
      type: "text" as const,
      required: true,
      placeholder: "load_sales_fact",
    },
    {
      name: "dim_proc_name",
      label: "Dimension Procedure",
      type: "text" as const,
      required: true,
      placeholder: "load_customer_dim",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Integration Dependencies
          </h1>
          <p className="text-muted-foreground">
            Manage dependencies between fact and dimension procedures
          </p>
        </div>
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Edit Dependency #${editing.dependency_id}`
                : "Add Integration Dependency"}
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
                <Label>Fact Procedure Name</Label>
                <Input
                  {...form.register("fact_proc_name")}
                  placeholder="load_sales_fact"
                />
              </div>

              <div className="space-y-2">
                <Label>Dimension Procedure Name</Label>
                <Input
                  {...form.register("dim_proc_name")}
                  placeholder="load_customer_dim"
                />
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
              <Button type="submit">{editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
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
              showVersionFilter={false}
              showStatusFilter={false}
              showBatchFilter={false}
              showDateFilter={false}
            />

            <Card className="professional-card">
              <CardContent className="p-0">
                <DataTable
                  data={displayed}
                  columns={columns}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batch" className="space-y-6">
            <BatchEditMetadata
              title="Integration Dependencies (Batch)"
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
      </div>

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
            <DialogTitle>Delete Integration Dependency</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>Are you sure you want to delete this integration dependency?</p>
            <p className="mt-3 font-medium">
              {toDelete
                ? `#${toDelete.dependency_id} — ${toDelete.fact_proc_name} → ${toDelete.dim_proc_name}`
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

export default IntegrationDependenciesPage;

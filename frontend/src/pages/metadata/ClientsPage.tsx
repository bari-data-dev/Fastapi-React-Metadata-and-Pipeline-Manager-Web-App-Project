// src/pages/metadata/ClientsPage.tsx
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
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
import { clientReferenceApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { ClientReference, FilterOptions } from "@/types";

const ClientsPage = () => {
  const [clients, setClients] = useState<ClientReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const { toast } = useToast();

  // new: control active tab so we can programmatically switch back to 'view'
  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // Dialog state for single add / edit (kept like previously)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientReference | null>(
    null
  );
  const [formData, setFormData] = useState({
    client_schema: "",
    client_name: "",
    last_batch_id: "",
  });

  // DELETE dialog state (new)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientReference | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // Load clients when page mounts or when filters change
  useEffect(() => {
    loadClients(filters.clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadClients = async (clientId?: number) => {
    try {
      setLoading(true);
      const resp = await clientReferenceApi.getAll(clientId);
      setClients(resp?.data ?? []);
    } catch (err) {
      console.error("Failed to load clients", err);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // No batch-id filtering on the page anymore; show all clients (clientId filter still applied by backend)
  const filteredClients = clients;

  const confirmDelete = (client: ClientReference) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const performDelete = async () => {
    if (!clientToDelete) return;
    try {
      setDeleting(true);
      await clientReferenceApi.delete(clientToDelete.client_id);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      toast({
        title: "Deleted",
        description: "Client deleted successfully",
        variant: "default",
      });
      // reload
      loadClients(filters.clientId);
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "client_id", label: "ID", sortable: true },
    { key: "client_name", label: "Client Name", sortable: true },
    { key: "client_schema", label: "Schema", sortable: true },
    { key: "last_batch_id", label: "Last Batch", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, client: ClientReference) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(client)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirmDelete(client)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Dialog open for add single
  const openAddDialog = () => {
    setEditingClient(null);
    setFormData({ client_schema: "", client_name: "", last_batch_id: "" });
    setIsDialogOpen(true);
  };

  const handleEdit = (client: ClientReference) => {
    setEditingClient(client);
    setFormData({
      client_schema: client.client_schema,
      client_name: client.client_name,
      last_batch_id: client.last_batch_id ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        // update
        await clientReferenceApi.update(editingClient.client_id, {
          client_schema: formData.client_schema,
          client_name: formData.client_name,
          last_batch_id: formData.last_batch_id || undefined,
        });
        toast({
          title: "Success",
          description: "Client updated successfully",
        });
      } else {
        // create single
        await clientReferenceApi.create({
          client_schema: formData.client_schema,
          client_name: formData.client_name,
          last_batch_id: formData.last_batch_id || undefined,
        });
        toast({
          title: "Success",
          description: "Client created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      setFormData({ client_schema: "", client_name: "", last_batch_id: "" });
      loadClients(filters.clientId);
    } catch (err) {
      console.error("submit error", err);
      toast({
        title: "Error",
        description: `Failed to ${editingClient ? "update" : "create"} client`,
        variant: "destructive",
      });
    }
  };

  // Handle batch-add from BatchEditMetadata.
  // Expect `rows` array where each item has { client_schema, client_name, last_batch_id? }
  const handleBatchAdd = async (rows: any[]) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      toast({
        title: "Error",
        description: "No rows to add",
        variant: "destructive",
      });
      return;
    }
    // Basic validation: each must have client_schema and client_name
    const bad = rows.some((r) => !r.client_schema || !r.client_name);
    if (bad) {
      toast({
        title: "Error",
        description: "Each row must include client_schema and client_name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await clientReferenceApi.batchAdd(
        rows.map((r) => ({
          client_schema: r.client_schema,
          client_name: r.client_name,
          last_batch_id: r.last_batch_id || undefined,
        }))
      );
      toast({ title: "Success", description: `${rows.length} clients added` });
      loadClients(filters.clientId);
    } catch (err) {
      console.error("batch add error", err);
      toast({
        title: "Error",
        description: "Failed to add clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Add Client button on the right (consistent placement) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Client Reference
          </h1>
          <p className="text-muted-foreground">
            Manage client references and batch entries
          </p>
        </div>

        {/* Single add dialog (kept visible in header like other pages) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md bg-background">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        client_name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_schema">Schema</Label>
                  <Input
                    id="client_schema"
                    value={formData.client_schema}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        client_schema: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_batch_id">Last Batch ID</Label>
                <Input
                  id="last_batch_id"
                  value={formData.last_batch_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      last_batch_id: e.target.value,
                    }))
                  }
                  placeholder="BATCH001"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="interactive-button">
                  {editingClient ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete confirmation dialog (styled like other dialogs) */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setClientToDelete(null);
          }
          setDeleteDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>Are you sure you want to delete the following client?</p>
            <p className="mt-3 font-medium">
              {clientToDelete?.client_name ??
                clientToDelete?.client_schema ??
                ""}
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

      {/* Tabs: View / Add Batch (mirrors ConfigPage layout)
          NOTE: Tabs is now controlled via activeTab so we can switch programmatically */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "view" | "batch")}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="view">View Clients</TabsTrigger>
          <TabsTrigger value="batch">Add Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-6">
          {/* Filters: show client select only (removed batch filter) */}
          <MetadataListFilter
            onFiltersChange={setFilters}
            loading={loading}
            showVersionFilter={false}
            showStatusFilter={false}
            showBatchFilter={false}
          />

          {/* Data Table */}
          <Card className="professional-card">
            <CardContent className="p-0">
              <DataTable
                data={filteredClients}
                columns={columns}
                loading={loading}
                searchPlaceholder="Search clients..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchEditMetadata
            title="Add Clients (Batch)"
            fields={[
              {
                name: "client_schema",
                label: "Schema",
                type: "text",
                required: true,
                placeholder: "Nama Schema (ex : Client1)",
              },
              {
                name: "client_name",
                label: "Client Name",
                type: "text",
                required: true,
                placeholder: "Nama Client (ex: Bebas)",
              },
              {
                name: "last_batch_id",
                label: "Last Batch ID",
                type: "text",
                required: false,
                placeholder: "BATCH000000",
              },
            ]}
            initialData={[]} // empty by default
            onSave={async (data: any[]) => {
              await handleBatchAdd(data);
            }}
            loading={loading}
            // when BatchEditMetadata calls onSaved, we set tab back to view and refresh clients
            onSaved={() => {
              setActiveTab("view");
              // reload clients once we switch back
              loadClients(filters.clientId);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientsPage;

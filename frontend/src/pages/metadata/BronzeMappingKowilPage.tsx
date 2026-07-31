// src/pages/metadata/BronzeMappingKowilPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/common/DataTable";
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
import { BronzeMappingKowilApi } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import type { BronzeMappingKowil } from "@/types";

const BronzeMappingKowilPage = () => {
  const [rows, setRows] = useState<BronzeMappingKowil[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"view" | "batch">("view");

  // dialog add/edit
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BronzeMappingKowil | null>(null);

  const [formData, setFormData] = useState({
    kowil_baru_sept25: "",
    spv_2: "",
    asm_2: "",
    rsm: "",
  });

  // delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<BronzeMappingKowil | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const resp = await BronzeMappingKowilApi.getAll();
      setRows(resp?.data ?? []);
    } catch (err) {
      console.error("Failed to load mapping kowil", err);
      toast({
        title: "Error",
        description: "Failed to load mapping kowil",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddDialog = () => {
    setEditingRow(null);
    setFormData({
      kowil_baru_sept25: "",
      spv_2: "",
      asm_2: "",
      rsm: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (r: BronzeMappingKowil) => {
    setEditingRow(r);
    setFormData({
      kowil_baru_sept25: r.kowil_baru_sept25 ?? "",
      spv_2: r.spv_2 ?? "",
      asm_2: r.asm_2 ?? "",
      rsm: r.rsm ?? "",
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = (r: BronzeMappingKowil) => {
    setRowToDelete(r);
    setDeleteDialogOpen(true);
  };

  const performDelete = async () => {
    if (!rowToDelete) return;
    try {
      setDeleting(true);
      await BronzeMappingKowilApi.delete(rowToDelete.mapping_id);
      setDeleteDialogOpen(false);
      setRowToDelete(null);
      toast({
        title: "Deleted",
        description: "Mapping kowil deleted successfully",
      });
      loadData();
    } catch (err) {
      console.error("delete error", err);
      toast({
        title: "Error",
        description: "Failed to delete mapping kowil",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const buildPayloadFromForm = () => {
    // convert "" -> undefined supaya backend bisa treat kosong sebagai None
    const payload = {
      kowil_baru_sept25: formData.kowil_baru_sept25.trim() || undefined,
      spv_2: formData.spv_2.trim() || undefined,
      asm_2: formData.asm_2.trim() || undefined,
      rsm: formData.rsm.trim() || undefined,
    };

    const hasAny = Object.values(payload).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ""
    );

    return { payload, hasAny };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { payload, hasAny } = buildPayloadFromForm();
    if (!hasAny) {
      toast({
        title: "Error",
        description: "At least one field must be provided",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingRow) {
        await BronzeMappingKowilApi.update(editingRow.mapping_id, payload);
        toast({
          title: "Success",
          description: "Mapping kowil updated successfully",
        });
      } else {
        await BronzeMappingKowilApi.create(payload);
        toast({
          title: "Success",
          description: "Mapping kowil created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingRow(null);
      loadData();
    } catch (err) {
      console.error("submit error", err);
      toast({
        title: "Error",
        description: `Failed to ${editingRow ? "update" : "create"} mapping kowil`,
        variant: "destructive",
      });
    }
  };

  const handleBatchAdd = async (data: any[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      toast({
        title: "Error",
        description: "No rows to add",
        variant: "destructive",
      });
      return;
    }

    // minimal validation: each row must have at least one field non-empty
    const invalid = data.some((r) => {
      const values = [r.kowil_baru_sept25, r.spv_2, r.asm_2, r.rsm];
      return !values.some(
        (v) => v !== undefined && v !== null && String(v).trim() !== ""
      );
    });

    if (invalid) {
      toast({
        title: "Error",
        description: "Each row must include at least one non-empty field",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await BronzeMappingKowilApi.batchAdd(
        data.map((r) => ({
          kowil_baru_sept25: (r.kowil_baru_sept25 ?? "").trim() || undefined,
          spv_2: (r.spv_2 ?? "").trim() || undefined,
          asm_2: (r.asm_2 ?? "").trim() || undefined,
          rsm: (r.rsm ?? "").trim() || undefined,
        }))
      );

      toast({
        title: "Success",
        description: `${data.length} mapping kowil added`,
      });

      setActiveTab("view");
      loadData();
    } catch (err) {
      console.error("batch add error", err);
      toast({
        title: "Error",
        description: "Failed to add mapping kowil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ FILTER + DISTINCT
  // - Buang kowil kosong
  // - Buang kowil yang punya "/"
  // - Distinct by kowil_baru_sept25 (case-insensitive, trimmed)
  // - Ambil row "terbaru" per kowil (dwh_loaded_at, fallback mapping_id)
  const filteredDistinctRows = useMemo(() => {
    const cleaned = rows.filter((r) => {
      const kowil = (r.kowil_baru_sept25 ?? "").toString().trim();
      if (!kowil) return false;
      if (kowil.includes("/")) return false;
      return true;
    });

    const pickNewer = (a: BronzeMappingKowil, b: BronzeMappingKowil) => {
      const ta = a.dwh_loaded_at ? Date.parse(String(a.dwh_loaded_at)) : NaN;
      const tb = b.dwh_loaded_at ? Date.parse(String(b.dwh_loaded_at)) : NaN;

      if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
        return ta >= tb ? a : b;
      }
      if (!Number.isNaN(ta) && Number.isNaN(tb)) return a;
      if (Number.isNaN(ta) && !Number.isNaN(tb)) return b;

      // fallback: pilih mapping_id terbesar
      return (a.mapping_id ?? 0) >= (b.mapping_id ?? 0) ? a : b;
    };

    const map = new Map<string, BronzeMappingKowil>();

    for (const r of cleaned) {
      const key = (r.kowil_baru_sept25 ?? "").toString().trim().toLowerCase();
      const existing = map.get(key);
      map.set(key, existing ? pickNewer(existing, r) : r);
    }

    return Array.from(map.values());
  }, [rows]);

  const columns = useMemo(
    () => [
      { key: "mapping_id", label: "ID", sortable: true },
      { key: "kowil_baru_sept25", label: "Kowil", sortable: true },
      { key: "spv_2", label: "SPV", sortable: true },
      { key: "asm_2", label: "ASM", sortable: true },
      { key: "rsm", label: "RSM", sortable: true },
      {
        key: "dwh_loaded_at",
        label: "Loaded At",
        sortable: true,
        render: (_: any, r: BronzeMappingKowil) =>
          r.dwh_loaded_at
            ? String(r.dwh_loaded_at).replace("T", " ").slice(0, 19)
            : "",
      },
      {
        key: "actions",
        label: "Actions",
        render: (_: any, r: BronzeMappingKowil) => (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(r)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => confirmDelete(r)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="h-full w-full p-6 space-y-6 flex flex-col overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bronze Mapping Kowil
          </h1>
          <p className="text-muted-foreground">
            Manage mapping data for CRM kowil (create, update, delete, batch add)
          </p>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl bg-background">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? "Edit Mapping Kowil" : "Add New Mapping Kowil"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kowil_baru_sept25">Kowil Baru Sept25</Label>
              <Input
                id="kowil_baru_sept25"
                value={formData.kowil_baru_sept25}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    kowil_baru_sept25: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spv_2">SPV</Label>
              <Input
                id="spv_2"
                value={formData.spv_2}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, spv_2: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asm_2">ASM 2</Label>
              <Input
                id="asm_2"
                value={formData.asm_2}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, asm_2: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rsm">RSM</Label>
              <Input
                id="rsm"
                value={formData.rsm}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, rsm: e.target.value }))
                }
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
                {editingRow ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) setRowToDelete(null);
          setDeleteDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Delete Mapping Kowil</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p>Are you sure you want to delete this record?</p>
            <p className="mt-3 font-medium">ID: {rowToDelete?.mapping_id ?? "-"}</p>
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

      {/* Tabs */}
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
          <Card className="professional-card">
            <CardContent className="p-0">
              <DataTable
                data={filteredDistinctRows} 
                columns={columns}
                loading={loading}
                searchPlaceholder="Search mapping kowil..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchEditMetadata
            title=""
            fields={[
              { name: "kowil_baru_sept25", label: "Kowil", type: "text", required: false },
              { name: "spv_2", label: "SPV", type: "text", required: false },
              { name: "asm_2", label: "ASM", type: "text", required: false },
              { name: "rsm", label: "RSM", type: "text", required: false },
            ]}
            initialData={[]}
            onSave={async (data: any[]) => {
              await handleBatchAdd(data);
            }}
            loading={loading}
            onSaved={() => {
              setActiveTab("view");
              loadData();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BronzeMappingKowilPage;

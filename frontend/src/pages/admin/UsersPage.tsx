import { FormEvent, useEffect, useState } from "react";
import { AppUser, authApi } from "@/lib/appApi";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

type UserRole = "ADMIN" | "PARSER";

type UserForm = {
  username: string;
  full_name: string;
  password: string;
  role: UserRole;
  is_active: boolean;
};

const EMPTY_CREATE_FORM: UserForm = {
  username: "",
  full_name: "",
  password: "",
  role: "PARSER",
  is_active: true,
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createForm, setCreateForm] =
    useState<UserForm>(EMPTY_CREATE_FORM);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_CREATE_FORM);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authApi.users();
      setUsers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") void load();
  }, [user?.role]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);
    try {
      await authApi.createUser(createForm);
      setCreateForm(EMPTY_CREATE_FORM);
      setSuccess("User baru berhasil dibuat.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat user");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (item: AppUser) => {
    setError("");
    setSuccess("");
    setEditingUser(item);
    setEditForm({
      username: item.username,
      full_name: item.full_name,
      password: "",
      role: item.role,
      is_active: item.is_active,
    });
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingUser(null);
    setEditForm(EMPTY_CREATE_FORM);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    setError("");
    setSuccess("");
    setSavingEdit(true);

    const payload: Record<string, unknown> = {
      username: editForm.username,
      full_name: editForm.full_name,
      role: editForm.role,
      is_active: editForm.is_active,
    };
    if (editForm.password.trim()) {
      payload.password = editForm.password;
    }

    try {
      const response = await authApi.updateUser(editingUser.user_id, payload);
      const editedOwnAccount = editingUser.user_id === user?.user_id;
      setEditingUser(null);
      setEditForm(EMPTY_CREATE_FORM);
      setSuccess("Data user berhasil diperbarui.");
      await load();

      if (editedOwnAccount) {
        localStorage.setItem(
          "metadata_app_user",
          JSON.stringify(response.data)
        );
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui user");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (item: AppUser) => {
    setError("");
    setSuccess("");
    try {
      await authApi.updateUser(item.user_id, {
        is_active: !item.is_active,
      });
      setSuccess(
        item.is_active
          ? `${item.full_name} berhasil dinonaktifkan.`
          : `${item.full_name} berhasil diaktifkan.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah user");
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="p-6 text-destructive">
        Halaman ini hanya untuk ADMIN.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tambah dan perbarui akun ADMIN atau PARSER. Akun tidak dihapus;
          gunakan status INACTIVE untuk menonaktifkan akses.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {success}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah User</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={submitCreate}
            className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-5"
          >
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                required
                minLength={3}
                maxLength={100}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Lengkap</Label>
              <Input
                value={createForm.full_name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                required
                maxLength={191}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
              >
                <option value="PARSER">PARSER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Menambahkan..." : "Tambah User"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daftar User</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "ID",
                    "USERNAME",
                    "NAMA LENGKAP",
                    "ROLE",
                    "STATUS",
                    "LAST LOGIN",
                    "UPDATED AT",
                    "ACTION",
                  ].map((head) => (
                    <th
                      key={head}
                      className="border-b p-3 text-left text-xs font-semibold"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      Memuat user...
                    </td>
                  </tr>
                ) : users.length ? (
                  users.map((item) => {
                    const isOwnAccount = item.user_id === user.user_id;
                    return (
                      <tr key={item.user_id} className="hover:bg-muted/30">
                        <td className="border-b p-3 tabular-nums">
                          {item.user_id}
                        </td>
                        <td className="border-b p-3 font-medium">
                          {item.username}
                          {isOwnAccount && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="border-b p-3">{item.full_name}</td>
                        <td className="border-b p-3">{item.role}</td>
                        <td className="border-b p-3">
                          <span
                            className={
                              item.is_active
                                ? "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }
                          >
                            {item.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b p-3">
                          {formatDateTime(item.last_login_at)}
                        </td>
                        <td className="whitespace-nowrap border-b p-3">
                          {formatDateTime(item.updated_at)}
                        </td>
                        <td className="border-b p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isOwnAccount}
                              onClick={() => void toggleActive(item)}
                            >
                              {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Belum ada user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editingUser && (
        <div
          className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-0 sm:p-6"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeEdit();
          }}
        >
          <div className="flex min-h-full items-start justify-center sm:items-center sm:py-4">
            <Card className="flex min-h-[100dvh] w-full max-w-2xl flex-col rounded-none border-0 shadow-2xl sm:min-h-0 sm:rounded-xl sm:border">
              <CardHeader className="border-b">
                <CardTitle className="text-lg sm:text-xl">
                  Edit User #{editingUser.user_id}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Kosongkan password bila password lama tidak ingin diubah.
                </p>
              </CardHeader>
              <CardContent className="flex-1 p-4 sm:p-6">
                <form onSubmit={submitEdit} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Username</Label>
                      <Input
                        value={editForm.username}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            username: event.target.value,
                          }))
                        }
                        required
                        minLength={3}
                        maxLength={100}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nama Lengkap</Label>
                      <Input
                        value={editForm.full_name}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            full_name: event.target.value,
                          }))
                        }
                        required
                        maxLength={191}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Password Baru</Label>
                      <Input
                        type="password"
                        value={editForm.password}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        minLength={8}
                        maxLength={128}
                        placeholder="Kosongkan jika tidak diubah"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60"
                        value={editForm.role}
                        disabled={editingUser.user_id === user.user_id}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            role: event.target.value as UserRole,
                          }))
                        }
                      >
                        <option value="PARSER">PARSER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={editForm.is_active}
                      disabled={editingUser.user_id === user.user_id}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block font-medium">User aktif</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        User INACTIVE tidak dapat login. Admin yang sedang login
                        tidak dapat menonaktifkan akun sendiri.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEdit}
                      disabled={savingEdit}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savingEdit}>
                      {savingEdit ? "Menyimpan..." : "Update User"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

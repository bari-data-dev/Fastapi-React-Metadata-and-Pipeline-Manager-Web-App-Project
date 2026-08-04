import { FormEvent, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppRole, AppUser, authApi } from "@/lib/appApi";
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
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: AppRole[] = [
  "ADMIN",
  "PARSER-TEAM",
  "PARSER-INTERN",
  "MANAGER",
];

type UserForm = {
  username: string;
  full_name: string;
  password: string;
  role: AppRole;
};

const EMPTY_FORM: UserForm = {
  username: "",
  full_name: "",
  password: "",
  role: "PARSER-TEAM",
};

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

function RoleBadge({ role }: { role: AppRole }) {
  const classes: Record<AppRole, string> = {
    ADMIN:
      "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300",
    MANAGER:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
    "PARSER-TEAM":
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
    "PARSER-INTERN":
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        classes[role]
      )}
    >
      {role}
    </span>
  );
}

function StatusSwitch({
  checked,
  disabled,
  busy,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
          checked
            ? "border-emerald-500 bg-emerald-500"
            : "border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700",
          disabled && "cursor-not-allowed opacity-50",
          busy && "animate-pulse"
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      <span
        className={cn(
          "min-w-16 text-xs font-semibold",
          checked ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
        )}
      >
        {busy ? "SAVING" : checked ? "ACTIVE" : "INACTIVE"}
      </span>
    </div>
  );
}

export default function UsersPage() {
  const { user, updateCurrentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [createForm, setCreateForm] = useState<UserForm>(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM);
  const noticeTimer = useRef<number | null>(null);

  const canView = Boolean(
    user && ["ADMIN", "MANAGER", "PARSER-TEAM"].includes(user.role)
  );
  const canCreateOrEdit = user?.role === "ADMIN";
  const canToggle = user?.role === "ADMIN" || user?.role === "MANAGER";

  const showSuccess = (message: string) => {
    setSuccess(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setSuccess(""), 2500);
  };

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
    if (canView) void load();
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, [canView]);

  if (!user || !canView) {
    return <Navigate to="/" replace />;
  }

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateOrEdit) return;

    setCreating(true);
    setError("");
    try {
      const response = await authApi.createUser({
        ...createForm,
        is_active: true,
      });
      setUsers((current) =>
        [...current, response.data].sort((a, b) => a.user_id - b.user_id)
      );
      setCreateForm(EMPTY_FORM);
      showSuccess("User baru berhasil dibuat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat user");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (item: AppUser) => {
    if (!canCreateOrEdit) return;
    setError("");
    setEditingUser(item);
    setEditForm({
      username: item.username,
      full_name: item.full_name,
      password: "",
      role: item.role,
    });
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingUser(null);
    setEditForm(EMPTY_FORM);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser || !canCreateOrEdit) return;

    const payload: Record<string, unknown> = {
      username: editForm.username,
      full_name: editForm.full_name,
      role: editForm.role,
    };
    if (editForm.password.trim()) payload.password = editForm.password;

    setSavingEdit(true);
    setError("");
    try {
      const response = await authApi.updateUser(editingUser.user_id, payload);
      setUsers((current) =>
        current.map((item) =>
          item.user_id === response.data.user_id ? response.data : item
        )
      );
      if (response.data.user_id === user.user_id) {
        updateCurrentUser(response.data);
      }
      setEditingUser(null);
      setEditForm(EMPTY_FORM);
      showSuccess("Data user berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui user");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (item: AppUser) => {
    if (!canToggle || item.user_id === user.user_id || togglingIds.has(item.user_id)) {
      return;
    }

    const nextActive = !item.is_active;
    setError("");
    setTogglingIds((current) => new Set(current).add(item.user_id));
    setUsers((current) =>
      current.map((row) =>
        row.user_id === item.user_id ? { ...row, is_active: nextActive } : row
      )
    );

    try {
      const response = await authApi.updateUser(item.user_id, {
        is_active: nextActive,
      });
      setUsers((current) =>
        current.map((row) =>
          row.user_id === response.data.user_id ? response.data : row
        )
      );
      showSuccess(
        `${response.data.full_name} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`
      );
    } catch (err) {
      setUsers((current) =>
        current.map((row) =>
          row.user_id === item.user_id ? { ...row, is_active: item.is_active } : row
        )
      );
      setError(err instanceof Error ? err.message : "Gagal mengubah status user");
    } finally {
      setTogglingIds((current) => {
        const next = new Set(current);
        next.delete(item.user_id);
        return next;
      });
    }
  };

  return (
    <div className="min-w-0 space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canCreateOrEdit
            ? "ADMIN dapat menambah dan mengubah detail anggota. Status akses diatur langsung dari toggle tabel."
            : user.role === "MANAGER"
              ? "MANAGER hanya dapat mengaktifkan atau menonaktifkan anggota."
              : "PARSER-TEAM memiliki akses lihat saja ke daftar anggota."}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition-all dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {success}
        </p>
      )}

      {canCreateOrEdit && (
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
                      role: event.target.value as AppRole,
                    }))
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Menambahkan..." : "Tambah User"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daftar User</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "ID",
                    "USERNAME",
                    "NAMA LENGKAP",
                    "ROLE",
                    "STATUS AKSES",
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
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Memuat user...
                    </td>
                  </tr>
                ) : users.length ? (
                  users.map((item) => {
                    const isOwnAccount = item.user_id === user.user_id;
                    const busy = togglingIds.has(item.user_id);
                    return (
                      <tr key={item.user_id} className="hover:bg-muted/30">
                        <td className="border-b p-3 tabular-nums">{item.user_id}</td>
                        <td className="border-b p-3 font-medium">
                          {item.username}
                          {isOwnAccount && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="border-b p-3">{item.full_name}</td>
                        <td className="border-b p-3">
                          <RoleBadge role={item.role} />
                        </td>
                        <td className="border-b p-3">
                          <StatusSwitch
                            checked={item.is_active}
                            busy={busy}
                            disabled={!canToggle || isOwnAccount || busy}
                            onChange={() => void toggleActive(item)}
                          />
                        </td>
                        <td className="whitespace-nowrap border-b p-3">
                          {formatDateTime(item.last_login_at)}
                        </td>
                        <td className="whitespace-nowrap border-b p-3">
                          {formatDateTime(item.updated_at)}
                        </td>
                        <td className="border-b p-3">
                          {canCreateOrEdit ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(item)}
                            >
                              Edit Detail
                            </Button>
                          ) : canToggle ? (
                            <span className="text-xs text-muted-foreground">
                              Gunakan toggle status
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              View only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Belum ada user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editingUser && canCreateOrEdit && (
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
                  Status ACTIVE/INACTIVE tidak diubah di form ini. Gunakan toggle pada tabel.
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
                            role: event.target.value as AppRole,
                          }))
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEdit}
                      disabled={savingEdit}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savingEdit}>
                      {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
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

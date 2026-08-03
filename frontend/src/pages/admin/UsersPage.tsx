import { FormEvent, useEffect, useState } from "react";
import { authApi, AppUser } from "@/lib/appApi";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "", full_name: "", password: "", role: "PARSER" as "ADMIN" | "PARSER",
  });

  const load = async () => {
    try {
      const response = await authApi.users();
      setUsers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil user");
    }
  };

  useEffect(() => { if (user?.role === "ADMIN") void load(); }, [user?.role]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await authApi.createUser({ ...form, is_active: true });
      setForm({ username: "", full_name: "", password: "", role: "PARSER" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat user");
    }
  };

  const toggleActive = async (item: AppUser) => {
    try {
      await authApi.updateUser(item.user_id, { is_active: !item.is_active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah user");
    }
  };

  if (user?.role !== "ADMIN") {
    return <div className="p-6 text-destructive">Halaman ini hanya untuk ADMIN.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold">User Management</h1><p className="text-sm text-muted-foreground">Kelola akun ADMIN dan PARSER.</p></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader><CardTitle className="text-base">Tambah User</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} /></div>
            <div><Label>Nama Lengkap</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
            <div><Label>Role</Label><select className="w-full border rounded-md px-3 py-2 bg-background" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "PARSER" })}><option value="PARSER">PARSER</option><option value="ADMIN">ADMIN</option></select></div>
            <Button type="submit">Tambah</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr>{["ID", "Username", "Nama", "Role", "Status", "Last Login", "Action"].map((head) => <th key={head} className="text-left border-b p-2">{head}</th>)}</tr></thead>
            <tbody>{users.map((item) => <tr key={item.user_id}><td className="border-b p-2">{item.user_id}</td><td className="border-b p-2">{item.username}</td><td className="border-b p-2">{item.full_name}</td><td className="border-b p-2">{item.role}</td><td className="border-b p-2">{item.is_active ? "ACTIVE" : "INACTIVE"}</td><td className="border-b p-2">{item.last_login_at || "-"}</td><td className="border-b p-2"><Button size="sm" variant="outline" disabled={item.user_id === user.user_id} onClick={() => void toggleActive(item)}>{item.is_active ? "Nonaktifkan" : "Aktifkan"}</Button></td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

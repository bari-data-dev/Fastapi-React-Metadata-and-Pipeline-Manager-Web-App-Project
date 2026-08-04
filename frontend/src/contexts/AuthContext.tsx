import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppUser, authApi } from "@/lib/appApi";


type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateCurrentUser: (nextUser: AppUser) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    const raw = localStorage.getItem("metadata_app_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("metadata_app_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((response) => {
        setUser(response.data);
        localStorage.setItem("metadata_app_user", JSON.stringify(response.data));
      })
      .catch(() => {
        localStorage.removeItem("metadata_app_token");
        localStorage.removeItem("metadata_app_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    localStorage.setItem("metadata_app_token", response.data.access_token);
    localStorage.setItem("metadata_app_user", JSON.stringify(response.data.user));
    setUser(response.data.user);
  };

  const logout = () => {
    localStorage.removeItem("metadata_app_token");
    localStorage.removeItem("metadata_app_user");
    setUser(null);
  };

  const updateCurrentUser = (nextUser: AppUser) => {
    localStorage.setItem("metadata_app_user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, updateCurrentUser }),
    [user, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return context;
}

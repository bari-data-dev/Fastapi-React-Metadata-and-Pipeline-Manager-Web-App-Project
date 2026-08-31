import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { InteractionEnhancements } from "@/components/layout/InteractionEnhancements";
import { PageTransition } from "@/components/layout/PageTransition";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import ArtbstPage from "./pages/metadata/ArtbstPage";
import OdistsParsingPage from "./pages/metadata/OdistsParsingPage";
import ProdukDistributorPage from "./pages/metadata/ProdukDistributorPage";
import ActivityReportPage from "./pages/reports/ActivityReportPage";
import ParsingReportPage from "./pages/reports/ParsingReportPage";
import UsersPage from "./pages/admin/UsersPage";

const queryClient = new QueryClient();
const SIDEBAR_STORAGE_KEY = "metadata_app_sidebar_open";
const DEFAULT_PROTECTED_PATH = "/metadata/odists-parsing";
const PROTECTED_PATHS = [
  "/",
  "/metadata/odists-parsing",
  "/metadata/produk-distributor",
  "/metadata/artbst",
  "/reports/parsing",
  "/reports/activity",
  "/admin/users",
] as const;

type ProtectedPath = (typeof PROTECTED_PATHS)[number];

function isProtectedPath(pathname: string): pathname is ProtectedPath {
  return PROTECTED_PATHS.includes(pathname as ProtectedPath);
}

function PersistentProtectedPages() {
  const location = useLocation();
  const { user } = useAuth();
  const activePath = isProtectedPath(location.pathname)
    ? location.pathname
    : DEFAULT_PROTECTED_PATH;
  const [visitedPaths, setVisitedPaths] = useState<Set<ProtectedPath>>(
    () => new Set([activePath])
  );

  useEffect(() => {
    setVisitedPaths((current) => {
      if (current.has(activePath)) return current;
      const next = new Set(current);
      next.add(activePath);
      return next;
    });
  }, [activePath]);

  if (!isProtectedPath(location.pathname)) {
    return <Navigate to={DEFAULT_PROTECTED_PATH} replace />;
  }

  if (
    (location.pathname === "/metadata/produk-distributor" ||
      location.pathname === "/metadata/artbst" ||
      location.pathname === "/reports/activity") &&
    user?.role === "INTERN"
  ) {
    return <Navigate to={DEFAULT_PROTECTED_PATH} replace />;
  }

  const shouldRender = (path: ProtectedPath) =>
    path === activePath || visitedPaths.has(path);

  return (
    <>
      {shouldRender("/") && (
        <div hidden={activePath !== "/"} aria-hidden={activePath !== "/"}>
          <Index />
        </div>
      )}
      {shouldRender("/metadata/odists-parsing") && (
        <div
          hidden={activePath !== "/metadata/odists-parsing"}
          aria-hidden={activePath !== "/metadata/odists-parsing"}
        >
          <OdistsParsingPage />
        </div>
      )}
      {user?.role !== "INTERN" && shouldRender("/metadata/produk-distributor") && (
        <div
          hidden={activePath !== "/metadata/produk-distributor"}
          aria-hidden={activePath !== "/metadata/produk-distributor"}
        >
          <ProdukDistributorPage />
        </div>
      )}
      {user?.role !== "INTERN" && shouldRender("/metadata/artbst") && (
        <div
          hidden={activePath !== "/metadata/artbst"}
          aria-hidden={activePath !== "/metadata/artbst"}
        >
          <ArtbstPage />
        </div>
      )}
      {shouldRender("/reports/parsing") && (
        <div
          hidden={activePath !== "/reports/parsing"}
          aria-hidden={activePath !== "/reports/parsing"}
        >
          <ParsingReportPage />
        </div>
      )}
      {user?.role !== "INTERN" && shouldRender("/reports/activity") && (
        <div
          hidden={activePath !== "/reports/activity"}
          aria-hidden={activePath !== "/reports/activity"}
        >
          <ActivityReportPage />
        </div>
      )}
      {shouldRender("/admin/users") && (
        <div
          hidden={activePath !== "/admin/users"}
          aria-hidden={activePath !== "/admin/users"}
        >
          <UsersPage />
        </div>
      )}
    </>
  );
}

function ProtectedContent() {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();

  const collapseSidebarFromPage = () => {
    if (isMobile) {
      setOpenMobile(false);
      return;
    }
    if (state === "expanded") setOpen(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <div
          className="flex-1 min-w-0"
          onPointerDownCapture={collapseSidebarFromPage}
        >
          <PageTransition>
            <PersistentProtectedPages />
          </PageTransition>
        </div>
      </main>
    </div>
  );
}

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const savedState = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return savedState === null ? true : savedState === "true";
  });

  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
      <ProtectedContent />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InteractionEnhancements />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/*" element={<ProtectedLayout />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

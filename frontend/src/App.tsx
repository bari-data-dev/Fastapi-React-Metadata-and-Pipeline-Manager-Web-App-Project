import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { InteractionEnhancements } from "@/components/layout/InteractionEnhancements";
import { PageTransition } from "@/components/layout/PageTransition";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import OdistsParsingPage from "./pages/metadata/OdistsParsingPage";
import ParsingReportPage from "./pages/reports/ParsingReportPageV3";
import UsersPage from "./pages/admin/UsersPage";

const queryClient = new QueryClient();
const SIDEBAR_STORAGE_KEY = "metadata_app_sidebar_open";

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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/metadata/odists-parsing" element={<OdistsParsingPage />} />
              <Route path="/reports/parsing" element={<ParsingReportPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="*" element={<Navigate to="/metadata/odists-parsing" replace />} />
            </Routes>
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

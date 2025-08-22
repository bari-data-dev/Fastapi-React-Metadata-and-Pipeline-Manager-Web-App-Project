import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ClientsPage from "./pages/metadata/ClientsPage";
import ConfigPage from "./pages/metadata/ConfigPage";
import MappingPage from "./pages/metadata/MappingPage";
import RequiredColumnsPage from "./pages/metadata/RequiredColumnsPage";
import TransformationsPage from "./pages/metadata/TransformationsPage";
import IntegrationsPage from "./pages/metadata/IntegrationsPage";
import IntegrationDependenciesPage from "./pages/metadata/IntegrationDependenciesPage";
import MvRefreshPage from "./pages/metadata/MvRefreshPage";
import FileAuditPage from "./pages/audit/FileAuditPage";
import JobExecutionPage from "./pages/audit/JobExecutionPage";
import MappingValidationPage from "./pages/audit/MappingValidationPage";
import RowValidationPage from "./pages/audit/RowValidationPage";
import LoadErrorsPage from "./pages/audit/LoadErrorsPage";
import TransformationLogsPage from "./pages/audit/TransformationLogsPage";
import IntegrationLogsPage from "./pages/audit/IntegrationLogsPage";
import MvRefreshLogsPage from "./pages/audit/MvRefreshLogsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <main className="flex-1 flex flex-col">
              <Header />
              <div className="flex-1">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  
                  {/* Metadata Management Routes */}
                  <Route path="/metadata/clients" element={<ClientsPage />} />
                  <Route path="/metadata/config" element={<ConfigPage />} />
                  <Route path="/metadata/mapping" element={<MappingPage />} />
                  <Route path="/metadata/required" element={<RequiredColumnsPage />} />
                  <Route path="/metadata/transform" element={<TransformationsPage />} />
                  <Route path="/metadata/integrations" element={<IntegrationsPage />} />
                  <Route path="/metadata/integration-dependencies" element={<IntegrationDependenciesPage />} />
                  <Route path="/metadata/mv-refresh" element={<MvRefreshPage />} />
                  
                  {/* Audit & Reports Routes */}
                  <Route path="/audit/files" element={<FileAuditPage />} />
                  <Route path="/audit/jobs" element={<JobExecutionPage />} />
                  <Route path="/audit/mapping" element={<MappingValidationPage />} />
                  <Route path="/audit/rows" element={<RowValidationPage />} />
                  <Route path="/audit/errors" element={<LoadErrorsPage />} />
                  <Route path="/audit/transform" element={<TransformationLogsPage />} />
                  <Route path="/audit/integration-logs" element={<IntegrationLogsPage />} />
                  <Route path="/audit/mv-refresh-logs" element={<MvRefreshLogsPage />} />
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </main>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

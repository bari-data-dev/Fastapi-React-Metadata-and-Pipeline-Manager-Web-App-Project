import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Database,
  FileText,
  Settings,
  BarChart3,
  Users,
  MapPin,
  CheckSquare,
  Zap,
  Puzzle,
  RefreshCw,
  FileSearch,
  AlertTriangle,
  Activity,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const metadataItems = [
  { title: "Client Reference", url: "/metadata/clients", icon: Users },
  { title: "Client Config", url: "/metadata/config", icon: Settings },
  { title: "Column Mapping", url: "/metadata/mapping", icon: MapPin },
  { title: "Required Columns", url: "/metadata/required", icon: CheckSquare },
  { title: "Transformations", url: "/metadata/transform", icon: Zap },
  { title: "Integrations", url: "/metadata/integrations", icon: Puzzle },
  { title: "Integration Dependencies",url: "/metadata/integration-dependencies",icon: Puzzle,},
  { title: "MV Refresh Config", url: "/metadata/mv-refresh", icon: RefreshCw },
];

const auditItems = [
  { title: "File Audit Logs", url: "/audit/files", icon: FileText },
  { title: "Job Execution", url: "/audit/jobs", icon: PlayCircle },
  { title: "Mapping Validation", url: "/audit/mapping", icon: FileSearch },
  { title: "Row Validation", url: "/audit/rows", icon: AlertTriangle },
  { title: "Load Errors", url: "/audit/errors", icon: AlertTriangle },
  { title: "Transformations", url: "/audit/transform", icon: Activity },
  { title: "Integration Logs", url: "/audit/integration-logs", icon: Activity },
  { title: "MV Refresh Logs", url: "/audit/mv-refresh-logs", icon: RefreshCw },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar(); // library state
  const location = useLocation();

  // decide default collapsed for initial render: true only when path is exactly '/'
  const initialCollapsed = location.pathname === "/";

  // local render state used BEFORE dan SELAMA sinkronisasi dengan library
  const [renderCollapsed, setRenderCollapsed] =
    useState<boolean>(initialCollapsed);

  // ready true setelah kita sinkronkan library; setelah ready, gunakan state dari library
  const [ready, setReady] = useState<boolean>(false);

  // guard supaya effect sinkron hanya dijalankan sekali per mount nyata (menghindari double-run dev)
  const initRef = useRef(false);

  /**
   * useLayoutEffect runs BEFORE browser paint.
   * - sinkronkan state library (useSidebar) dengan initialCollapsed
   * - langsung set ready = true (synchronous flush) sehingga first paint sudah dalam kondisi final
   *
   * Ini mencegah flicker/expand singkat karena perubahan state dan style sudah diterapkan
   * sebelum browser menggambar frame pertama.
   */
  useLayoutEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      const libraryCollapsed = state === "collapsed";
      if (libraryCollapsed !== initialCollapsed) {
        // toggleSidebar() biasanya mengubah state library synchronously (React state)
        // sehingga perubahan akan ter-flush sebelum paint karena kita di useLayoutEffect.
        toggleSidebar();
      }
    } catch (err) {
      console.warn("Sidebar sync error", err);
    } finally {
      // set ready synchronously (dibuat di useLayoutEffect sehingga flush sebelum paint)
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run sekali saat mount

  // on user toggle: update both render state (untuk responsiveness) and library
  const handleToggle = () => {
    try {
      toggleSidebar();
      setRenderCollapsed((prev) => !prev);
      setReady(true); // ensure we switch to library-driven rendering
    } catch (err) {
      console.warn("Sidebar toggle error", err);
    }
  };

  // effective collapsed state used for render:
  // - sebelum ready: pakai renderCollapsed (force)
  // - sesudah ready: pakai state dari library
  const collapsedEffective = ready ? state === "collapsed" : renderCollapsed;

  const isActive = (path: string) => location.pathname === path;
  const getNavClassName = (path: string) =>
    cn(
      "w-full transition-colors duration-200",
      isActive(path)
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    );

  return (
    <Sidebar
      // no suppress transitions here because useLayoutEffect ensures final state BEFORE paint.
      className={cn(
        "border-r border-sidebar-border transition-all duration-300",
        collapsedEffective ? "w-16" : "w-64"
      )}
      collapsible="icon"
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsedEffective && (
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-sidebar-primary" />
            <span className="font-bold text-lg gradient-text">
              Metadata Manager
            </span>
          </div>
        )}
        <button
          onClick={handleToggle}
          className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
          aria-label={collapsedEffective ? "Open sidebar" : "Collapse sidebar"}
        >
          {collapsedEffective ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              "text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider mb-2",
              collapsedEffective && "sr-only"
            )}
          >
            Metadata Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {metadataItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClassName(item.url)}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          collapsedEffective ? "mx-auto" : "mr-3"
                        )}
                      />
                      {!collapsedEffective && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel
            className={cn(
              "text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider mb-2",
              collapsedEffective && "sr-only"
            )}
          >
            Data Audit & Reports
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {auditItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClassName(item.url)}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          collapsedEffective ? "mx-auto" : "mr-3"
                        )}
                      />
                      {!collapsedEffective && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel
            className={cn(
              "text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider mb-2",
              collapsedEffective && "sr-only"
            )}
          >
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard"
                    className={getNavClassName("/dashboard")}
                  >
                    <BarChart3
                      className={cn(
                        "h-4 w-4 shrink-0",
                        collapsedEffective ? "mx-auto" : "mr-3"
                      )}
                    />
                    {!collapsedEffective && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FileBarChart2,
  LogOut,
  TableProperties,
  Users,
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
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const DASHBOARD_URL = "https://dashboard.galenium.com/reports/browse";

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile memakai drawer penuh. State collapse hanya berlaku di desktop.
  const collapsed = !isMobile && state === "collapsed";

  const items = [
    {
      title: "ODIST Parsing",
      url: "/metadata/odists-parsing",
      icon: TableProperties,
    },
    ...(user?.role === "ADMIN"
      ? [{ title: "User Management", url: "/admin/users", icon: Users }]
      : []),
  ];

  const navClass = (path: string) =>
    cn(
      "w-full transition-colors duration-200",
      location.pathname === path
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    );

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = () => {
    if (isMobile) setOpenMobile(false);
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      collapsible="icon"
    >
      <div className="flex min-h-16 items-center justify-between gap-2 border-b border-sidebar-border p-4">
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2">
            <Database className="h-6 w-6 shrink-0" />
            <span className="truncate font-bold">Metadata Manager</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="ml-auto rounded-md p-2 hover:bg-sidebar-accent"
          aria-label={isMobile ? "Tutup sidebar" : "Toggle sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            Data Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={navClass(item.url)}
                      onClick={closeMobileSidebar}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          collapsed ? "mx-auto" : "mr-3"
                        )}
                      />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/reports/parsing"
                    className={navClass("/reports/parsing")}
                    onClick={closeMobileSidebar}
                  >
                    <FileBarChart2
                      className={cn(
                        "h-4 w-4 shrink-0",
                        collapsed ? "mx-auto" : "mr-3"
                      )}
                    />
                    {!collapsed && <span>Parsing Report</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    href={DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full hover:bg-sidebar-accent/50"
                    onClick={closeMobileSidebar}
                  >
                    <BarChart3
                      className={cn(
                        "h-4 w-4 shrink-0",
                        collapsed ? "mx-auto" : "mr-3"
                      )}
                    />
                    {!collapsed && <span>Dashboard</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto border-t border-sidebar-border p-2">
        {!collapsed && (
          <div className="min-w-0 px-2 py-2">
            <div className="truncate text-sm font-medium text-foreground">
              {user?.full_name || user?.username || "User"}
            </div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">
              {user?.role || "-"}
            </div>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={handleLogout}
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              title={collapsed ? "Logout" : undefined}
            >
              <LogOut
                className={cn(
                  "h-4 w-4 shrink-0",
                  collapsed ? "mx-auto" : "mr-3"
                )}
              />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  );
}

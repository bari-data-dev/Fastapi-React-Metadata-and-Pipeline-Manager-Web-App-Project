import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronRight, Database, TableProperties, Users } from "lucide-react";
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
  const { state, toggleSidebar } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const items = [
    { title: "ODIST Parsing", url: "/metadata/odists-parsing", icon: TableProperties },
    ...(user?.role === "ADMIN" ? [{ title: "User Management", url: "/admin/users", icon: Users }] : []),
  ];

  const navClass = (path: string) => cn(
    "w-full transition-colors duration-200",
    location.pathname === path
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
  );

  const collapseAfterNavigation = () => {
    if (!collapsed) toggleSidebar();
  };

  return (
    <Sidebar className={cn("border-r border-sidebar-border transition-all duration-300", collapsed ? "w-16" : "w-64")} collapsible="icon">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && <div className="flex items-center gap-2"><Database className="h-6 w-6" /><span className="font-bold">Metadata Manager</span></div>}
        <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-sidebar-accent" aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>Data Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={navClass(item.url)} onClick={collapseAfterNavigation}>
                      <item.icon className={cn("h-4 w-4 shrink-0", collapsed ? "mx-auto" : "mr-3")} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="w-full hover:bg-sidebar-accent/50" onClick={collapseAfterNavigation}>
                    <BarChart3 className={cn("h-4 w-4 shrink-0", collapsed ? "mx-auto" : "mr-3")} />
                    {!collapsed && <span>Dashboard</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

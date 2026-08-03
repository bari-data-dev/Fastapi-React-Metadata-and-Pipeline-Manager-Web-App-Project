import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink, Home, LogOut, Settings, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";


export function Header() {
  const navigate = useNavigate();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const isCollapsed = sidebarState === "collapsed";

  const handleHomeClick = () => {
    if (!isCollapsed) toggleSidebar();
    navigate("/");
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const lgLeftClass = isCollapsed ? "lg:left-16" : "lg:left-64";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 transition-all duration-300 ${lgLeftClass}`}
      >
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <SidebarTrigger className="lg:hidden" />
            <div className="hidden lg:block min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">
                Data Pipeline Management
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                Monitor and manage your metadata configurations
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex items-center space-x-2"
              onClick={() => window.open("http://192.100.38.52:4200/", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Prefect UI</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={handleHomeClick} aria-label="Home">
              <Home className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-3 font-medium">
                  {user?.full_name || user?.username || "User"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-popover" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.full_name || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.username}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="h-16" aria-hidden />
    </>
  );
}

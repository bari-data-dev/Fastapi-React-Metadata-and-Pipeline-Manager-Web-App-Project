// Header.tsx (replace with this)
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Settings, User, LogOut, ExternalLink, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Header() {
  const navigate = useNavigate();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";

  const handleHomeClick = (e?: React.MouseEvent) => {
    if (!isCollapsed) {
      toggleSidebar();
    }
    navigate("/");
  };

  /**
   * Behavior:
   * - mobile / sm: header full width (left: 0)
   * - lg+: header left offset follows sidebar width:
   *     collapsed -> left: 4rem (w-16)
   *     expanded  -> left: 16rem (w-64)
   *
   * We use Tailwind responsive classes so behavior is CSS-driven and avoids layout thrash.
   */
  const lgLeftClass = isCollapsed ? "lg:left-16" : "lg:left-64";

  return (
    <>
      <header
        // base left-0 right-0 for small screens, overridden by lg:left-16 / lg:left-64
        className={`fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 transition-all duration-300 ${lgLeftClass}`}
      >
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            {/* show hamburger on small screens */}
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

          <div className="flex items-center space-x-4 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex items-center space-x-2"
              onClick={() => window.open("http://127.0.0.1:4200", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Prefect UI</span>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <button type="button" onClick={handleHomeClick} aria-label="Home">
                <Home className="h-4 w-4" />
              </button>
            </Button>

            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-xs" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-popover"
                align="end"
                forceMount
              >
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* spacer supaya tidak menutupi konten */}
      <div className="h-16" aria-hidden />
    </>
  );
}

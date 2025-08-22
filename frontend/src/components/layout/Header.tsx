import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell, Settings, User, LogOut, ExternalLink, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const navigate = useNavigate();
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const isCollapsed = sidebarState === 'collapsed';

  const handleHomeClick = (e?: React.MouseEvent) => {
    // collapse sidebar if it's not collapsed
    if (!isCollapsed) {
      toggleSidebar();
    }
    // navigate to home (SPA)
    navigate('/');
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <SidebarTrigger className="lg:hidden" />
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-foreground">
              Data Pipeline Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage your metadata configurations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Quick Actions */}
          <Button 
            variant="outline" 
            size="sm" 
            className="hidden md:flex items-center space-x-2"
            onClick={() => window.open('/prefect', '_blank')} // contoh, sesuaikan jika perlu
          >
            <ExternalLink className="h-4 w-4" />
            <span>Prefect UI</span>
          </Button>

          {/* Home - pakai button sehingga kita bisa collapse sidebar sebelum navigasi */}
          <Button variant="ghost" size="sm" asChild>
            <button type="button" onClick={handleHomeClick} aria-label="Home">
              <Home className="h-4 w-4" />
            </button>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-xs"></span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-popover" align="end" forceMount>
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
  );
}

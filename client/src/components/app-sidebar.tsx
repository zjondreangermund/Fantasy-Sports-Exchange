import { useLocation, Link } from "wouter";
// Fixed alias: @/hooks -> ../hooks
import { useAuth } from "../hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "./ui/sidebar"; // Fixed alias: @/components/ui -> ./ui
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Library,
  ShoppingCart,
  Wallet,
  Trophy,
  Activity,
  LogOut,
  Shield,
} from "lucide-react";

const menuItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Premier League", href: "/premier-league", icon: Activity },
  { title: "Competitions", href: "/competitions", icon: Trophy },
  { title: "Collection", href: "/collection", icon: Library },
  { title: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { title: "Wallet", href: "/wallet", icon: Wallet },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // This query checks your Admin ID (50198883) via the backend
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const allItems = adminCheck?.isAdmin
    ? [...menuItems, { title: "Admin", href: "/admin", icon: Shield }]
    : menuItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">
              FantasyFC
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                  >
                    <Link href={item.href} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2 px-1 mb-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">
              {user?.firstName?.[0] || user?.email?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.firstName || user?.email || "Manager"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => (window.location.href = "/api/logout")}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
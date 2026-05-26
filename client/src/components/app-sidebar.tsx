import { useLocation, Link } from "wouter";
import { useAuth } from "../hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Library,
  ShoppingCart,
  Wallet,
  Trophy,
  Activity,
  Gem,
  LogOut,
  Shield,
  Gavel,
  Bell,
  BarChart3,
  Target,
  Swords,
} from "lucide-react";

const menuItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "My Team", href: "/collection", icon: Swords },
  { title: "Leagues", href: "/premier-league", icon: Activity },
  { title: "Tournaments", href: "/competitions", icon: Trophy },
  { title: "Marketplace", href: "/marketplace", icon: ShoppingCart },
  { title: "Auctions", href: "/auctions", icon: Gavel },
  { title: "Analytics", href: "/dashboard", icon: BarChart3 },
  { title: "Wallet", href: "/wallet", icon: Wallet },
  { title: "Account", href: "/account", icon: Bell },
  { title: "Card Lab", href: "/card-lab", icon: Gem },
];

function isActivePath(location: string, href: string) {
  if (href === "/") return location === "/" || location === "/dashboard";
  return location === href;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const allItems = adminCheck?.isAdmin
    ? [...menuItems, { title: "Admin", href: "/admin", icon: Shield }]
    : menuItems;

  return (
    <Sidebar className="border-r border-slate-800/80 bg-[#050812] text-slate-300">
      <SidebarHeader className="border-b border-slate-800/80 p-4">
        <Link href="/">
          <div className="group flex cursor-pointer items-center gap-3" data-testid="link-home">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400 via-blue-600 to-slate-950 shadow-[0_0_28px_rgba(59,130,246,0.28)]">
              <Target className="relative z-10 h-5 w-5 text-white" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.55),transparent_35%)]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-wide text-white">Fantasy Arena</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/60">Manager Hub</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="bg-[#050812] px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {allItems.map((item) => {
                const active = isActivePath(location, item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link
                        href={item.href}
                        data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        className={[
                          "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all",
                          active
                            ? "border-cyan-300/35 bg-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_24px_rgba(34,211,238,.08)]"
                            : "border-transparent text-slate-400 hover:border-slate-700/80 hover:bg-slate-900/75 hover:text-slate-100",
                        ].join(" ")}
                      >
                        <item.icon className={active ? "h-4 w-4 text-cyan-300" : "h-4 w-4 text-slate-500 group-hover:text-cyan-200"} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-800/80 bg-[#050812] p-3">
        <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-cyan-300/25">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-cyan-950 text-xs font-bold text-cyan-100">
                {user?.firstName?.[0] || user?.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{user?.firstName || user?.email || "Manager"}</p>
              <p className="truncate text-[11px] text-slate-500">Club owner</p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-200"
          onClick={async () => {
            await Promise.resolve(logout());
            window.location.assign("/");
          }}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

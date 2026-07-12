import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar } from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { LayoutDashboard, ShoppingCart, Wallet, Trophy, Activity, LogOut, Shield, Swords, UserCircle, Gift, Beaker, FastForward } from "lucide-react";

type NavItem = { title: string; href: string; icon: typeof LayoutDashboard; section: "Main" | "Account" };

const menuItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, section: "Main" },
  { title: "Play", href: "/competitions", icon: Trophy, section: "Main" },
  { title: "Prize Vault", href: "/prize-vault", icon: Gift, section: "Main" },
  { title: "Collection", href: "/collection", icon: Swords, section: "Main" },
  { title: "Marketplace", href: "/marketplace", icon: ShoppingCart, section: "Main" },
  { title: "Leagues", href: "/premier-league", icon: Activity, section: "Main" },
  { title: "Wallet", href: "/wallet", icon: Wallet, section: "Account" },
  { title: "Profile", href: "/account", icon: UserCircle, section: "Account" },
];

const sectionOrder: NavItem["section"][] = ["Main", "Account"];
function isActivePath(location: string, href: string) { if (href === "/") return location === "/" || location === "/dashboard"; return location === href; }

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  useEffect(() => { if (isMobile) setOpenMobile(false); }, [isMobile, location, setOpenMobile]);
  const closeMobileDrawer = () => { if (isMobile) setOpenMobile(false); };
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({ queryKey: ["/api/admin/check"] });
  const allItems: NavItem[] = adminCheck?.isAdmin ? [...menuItems, { title: "Admin", href: "/admin", icon: Shield, section: "Account" }, { title: "Test Console", href: "/admin/test-console", icon: Beaker, section: "Account" }, { title: "Season Simulator", href: "/admin/season-simulator", icon: FastForward, section: "Account" }] : menuItems;

  return (
    <Sidebar className="border-r border-slate-800/80 bg-[#050812] text-slate-300">
      <SidebarHeader className="border-b border-slate-800/80 p-4">
        <Link href="/"><div className="group flex cursor-pointer items-center gap-3" data-testid="link-home" onClick={closeMobileDrawer}><div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.22)]"><img src="/brand/fantasy-arena-icon.svg" alt="Fantasy Arena" className="h-11 w-11 object-contain" /><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.22),transparent_35%)]" /></div><div className="min-w-0"><p className="truncate text-sm font-black tracking-wide text-white">Fantasy Arena</p><p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/60">Play • Compete • Win</p></div></div></Link>
      </SidebarHeader>
      <SidebarContent className="bg-[#050812] px-2 py-4">
        {sectionOrder.map((section) => {
          const items = allItems.filter((item) => item.section === section);
          if (!items.length) return null;
          return <SidebarGroup key={section}><p className="px-3 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">{section}</p><SidebarGroupContent><SidebarMenu className="space-y-1.5">{items.map((item) => {
            const active = isActivePath(location, item.href);
            return <SidebarMenuItem key={item.title}><SidebarMenuButton asChild isActive={active}><Link href={item.href} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`} onClick={closeMobileDrawer} className={["group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all", active ? "border-cyan-300/35 bg-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_24px_rgba(34,211,238,.08)]" : "border-transparent text-slate-400 hover:border-slate-700/80 hover:bg-slate-900/75 hover:text-slate-100"].join(" ")}><item.icon className={active ? "h-4 w-4 text-cyan-300" : "h-4 w-4 text-slate-500 group-hover:text-cyan-200"} /><span>{item.title}</span></Link></SidebarMenuButton></SidebarMenuItem>;
          })}</SidebarMenu></SidebarGroupContent></SidebarGroup>;
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-slate-800/80 bg-[#050812] p-3">
        <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"><div className="flex items-center gap-3"><Avatar className="h-9 w-9 border border-cyan-300/25"><AvatarImage src={user?.profileImageUrl || undefined} /><AvatarFallback className="bg-cyan-950 text-xs font-bold text-cyan-100">{user?.firstName?.[0] || user?.email?.[0] || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{user?.firstName || user?.email || "Manager"}</p><p className="truncate text-[11px] text-slate-500">Club owner</p></div></div></div>
        <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-200" onClick={async () => { closeMobileDrawer(); await Promise.resolve(logout()); window.location.assign("/"); }} data-testid="button-logout"><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
      </SidebarFooter>
    </Sidebar>
  );
}

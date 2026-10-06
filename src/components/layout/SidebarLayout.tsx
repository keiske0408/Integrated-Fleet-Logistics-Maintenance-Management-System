import React, { useState, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Permission } from '@/features/auth/AuthContext';
import { useRoles } from '@/features/roles/RolesContext';
import { useTheme } from '@/features/theme/ThemeContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  LayoutDashboard,
  Wrench,
  Calendar,
  Shield,
  Copy,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Bell,
  Package,
  Database,
  Sun,
  Moon,
  ShieldCheck,
  History,
  Paintbrush,
} from 'lucide-react';

// ─── Route config ─────────────────────────────────────────────────────────────

export type AppPage =
  | 'dashboard'
  | 'fleet'
  | 'tsrf'
  | 'procurement'
  | 'maintenance_ref'
  | 'users'
  | 'roles'
  | 'history'
  | 'theme_editor'
  | 'form_builder'
  | 'reports';

/** Maps each AppPage key to its URL path. */
export const PAGE_ROUTES: Record<AppPage, string> = {
  dashboard: '/dashboard',
  fleet: '/fleet',
  tsrf: '/tsrf',
  procurement: '/procurement',
  reports: '/reports',
  users: '/users',
  roles: '/roles',
  maintenance_ref: '/reference-data',
  history: '/history',
  theme_editor: '/theme-editor',
  form_builder: '/form-builder',
};

/** Reverse lookup: URL path → AppPage. */
export const PATH_TO_PAGE: Record<string, AppPage> = Object.fromEntries(
  Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page as AppPage]),
) as Record<string, AppPage>;

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view:dashboard' },
  { id: 'fleet', label: 'Fleet & KM Monitoring', icon: Wrench, permission: 'view:fleet' },
  { id: 'tsrf', label: 'TSRF Logistics', icon: Calendar, permission: 'view:tsrf' },
  { id: 'procurement', label: 'PR Gatekeeper', icon: Shield, permission: 'view:procurement' },
  { id: 'reports', label: 'Reports', icon: Package, permission: 'view:reports' },
];

const SETTINGS_ITEMS: NavItem[] = [
  { id: 'users', label: 'User Management', icon: Users, permission: 'view:users' },
  { id: 'roles', label: 'Roles Management', icon: ShieldCheck, permission: 'view:roles' },
  {
    id: 'maintenance_ref',
    label: 'Reference Data',
    icon: Database,
    permission: 'view:maintenance_ref',
  },
  { id: 'history', label: 'Activity History', icon: History, permission: 'view:dashboard' },
  { id: 'theme_editor', label: 'Theme Editor', icon: Paintbrush, permission: 'view:dashboard' },
  { id: 'form_builder', label: 'Form Builder', icon: Copy, permission: 'manage:reference_data' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface SidebarLayoutProps {
  notifications?: number;
}

export function SidebarLayout({ notifications = 0 }: SidebarLayoutProps) {
  const { currentUser, logout, hasPermission } = useAuth();
  const { roles } = useRoles();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(item.permission)),
    [hasPermission],
  );
  const visibleSettings = useMemo(
    () => SETTINGS_ITEMS.filter((item) => hasPermission(item.permission)),
    [hasPermission],
  );

  // Derive current page label from URL for the breadcrumb
  const activeLabel = useMemo(() => {
    const matchedPath = Object.keys(PATH_TO_PAGE).find(
      (path) =>
        location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`)),
    );
    const activePage = (matchedPath ? PATH_TO_PAGE[matchedPath] : undefined) || 'dashboard';
    return [...NAV_ITEMS, ...SETTINGS_ITEMS].find((i) => i.id === activePage)?.label || 'Dashboard';
  }, [location.pathname]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const SidebarNavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const to = PAGE_ROUTES[item.id];
    return (
      <NavLink
        id={`nav-${item.id}`}
        to={to}
        onClick={closeMobile}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
            isActive || (to !== '/' && location.pathname.startsWith(`${to}/`))
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          } ${collapsed ? 'justify-center' : ''}`
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                isActive ? 'text-primary-foreground' : ''
              }`}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {isActive && !collapsed && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
            )}
          </>
        )}
      </NavLink>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}>
        <div className="p-2 rounded-xl bg-primary shadow-lg shadow-primary/30 shrink-0">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-foreground text-sm leading-tight">Hulma Fleet Hub</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Management System</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 py-2">
            Navigation
          </p>
        )}
        {collapsed && <div className="py-1" />}

        {visibleNav.map((item) => (
          <SidebarNavLink key={item.id} item={item} />
        ))}

        {/* Administration section */}
        {visibleSettings.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              {!collapsed && (
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 py-1">
                  Administration
                </p>
              )}
              {collapsed && <Separator className="my-2" />}
            </div>
            {visibleSettings.map((item) => (
              <SidebarNavLink key={item.id} item={item} />
            ))}
          </>
        )}
      </nav>

      <Separator />

      {/* Bottom: Theme toggle + User */}
      <div className="p-3 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-accent hover:text-foreground ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* User footer */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{currentUser?.avatarInitials}</AvatarFallback>
            </Avatar>
            <button
              onClick={logout}
              title="Sign Out"
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback>{currentUser?.avatarInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-foreground truncate">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser?.department}</p>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 shrink-0 relative ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] z-10 p-0.5 bg-card border border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all shadow-sm"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 bg-card border-r border-border flex flex-col h-full z-10 animate-slide-in-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-card border-b border-border px-4 md:px-6 h-14 flex items-center justify-between shrink-0">
          {/* Mobile menu */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb / page title */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Fleet Hub</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-semibold text-foreground">{activeLabel}</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle — mobile only (desktop is in sidebar) */}
            <button
              onClick={toggleTheme}
              className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notification bell */}
            <button className="relative text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent">
              <Bell className="h-4 w-4" />
              {notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>

            {/* Role badge */}
            {currentUser &&
              (() => {
                const roleDef = roles.find((r) => r.key === currentUser.role);
                return roleDef ? (
                  <span
                    className={`hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${roleDef.color}`}
                  >
                    {roleDef.label}
                  </span>
                ) : null;
              })()}

            {/* Avatar */}
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px]">{currentUser?.avatarInitials}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content — rendered by React Router's <Outlet> */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

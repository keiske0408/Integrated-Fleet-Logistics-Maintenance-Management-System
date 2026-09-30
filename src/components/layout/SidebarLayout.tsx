import React, { useState } from 'react';
import { useAuth, type Permission } from '@/features/auth/AuthContext';
import { useRoles } from '@/features/roles/RolesContext';
import { useTheme } from '@/features/theme/ThemeContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Truck, LayoutDashboard, Wrench, Calendar, Shield, Settings,
  Users, ChevronLeft, ChevronRight, LogOut, Menu, X, Bell,
  Package, Database, Sun, Moon, ShieldCheck, History, Paintbrush,
} from 'lucide-react';

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
  | 'reports';

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
  { id: 'maintenance_ref', label: 'Reference Data', icon: Database, permission: 'view:maintenance_ref' },
  { id: 'history', label: 'Activity History', icon: History, permission: 'view:dashboard' },
  { id: 'theme_editor', label: 'Theme Editor', icon: Paintbrush, permission: 'view:dashboard' },
];

interface SidebarLayoutProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: React.ReactNode;
  notifications?: number;
}

export function SidebarLayout({
  activePage, onNavigate, children, notifications = 0,
}: SidebarLayoutProps) {
  const { currentUser, logout, hasPermission } = useAuth();
  const { roles } = useRoles();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(item.permission));
  const visibleSettings = SETTINGS_ITEMS.filter((item) => hasPermission(item.permission));

  const NavButton = ({
    item, onClick,
  }: {
    item: NavItem;
    onClick: () => void;
  }) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    return (
      <button
        id={`nav-${item.id}`}
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
            isActive ? 'text-primary-foreground' : ''
          }`}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {isActive && !collapsed && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
        )}
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
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
          <NavButton
            key={item.id}
            item={item}
            onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
          />
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
              <NavButton
                key={item.id}
                item={item}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
              />
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
          {!collapsed && (
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          )}
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
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
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
            <span className="font-semibold text-foreground">
              {[...NAV_ITEMS, ...SETTINGS_ITEMS].find((i) => i.id === activePage)?.label || 'Dashboard'}
            </span>
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
            {currentUser && (() => {
              const roleDef = roles.find((r) => r.key === currentUser.role);
              return roleDef ? (
                <span className={`hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${roleDef.color}`}>
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

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

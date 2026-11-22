import React, { useState } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { useAccess, roleLabels } from '../lib/access';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BrandLockup } from './Brand';
import { useBranding } from '../lib/branding';
import alviProfile from '../../assets/alvi-profile.jpg';
import {
  Home,
  Users,
  Clock,
  DollarSign,
  UserPlus,
  TrendingUp,
  Settings,
  MessageCircle,
  Award,
  Bell,
  Search,
  Menu,
  Moon,
  Sun,
  ShieldCheck,
  ScrollText,
  LogOut,
} from 'lucide-react';

interface DashboardLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  children: React.ReactNode;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'recruitment', label: 'Recruitment', icon: UserPlus },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'engagement', label: 'Engagement', icon: Award },
  { id: 'ai-assistant', label: 'AI Assistant', icon: MessageCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'access', label: 'Access Control', icon: ShieldCheck },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function NavList({
  items,
  activeTab,
  onSelect,
  onDark,
  accent,
}: {
  items: typeof menuItems;
  activeTab: string;
  onSelect: (id: string) => void;
  onDark?: boolean;
  accent?: string;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            style={
              onDark && isActive
                ? { borderLeftColor: accent || 'var(--sidebar-accent, #3cd0f5)' }
                : undefined
            }
            className={[
              'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
              onDark
                ? isActive
                  ? 'bg-white/15 text-white border-l-2 font-medium'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
                : isActive
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            <Icon
              className={`w-5 h-5 shrink-0 ${
                onDark ? (isActive ? 'text-white' : 'text-white/70') : isActive ? 'text-primary' : ''
              }`}
            />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SidebarCopyright({ onDark = false }: { onDark?: boolean }) {
  const { company } = useBranding();
  const legal =
    company.legalName ||
    company.name ||
    'Automystics Technologies Pvt Ltd';
  return (
    <div
      className={`px-4 py-3 border-t text-[10px] leading-snug ${
        onDark ? 'border-white/10 text-white/55' : 'border-border text-muted-foreground'
      }`}
    >
      <p>Copyright © All rights reserved</p>
      <p className="mt-0.5 truncate" title={legal}>
        @{legal.replace(/^@/, '')}
      </p>
    </div>
  );
}

export function DashboardLayout({ activeTab, setActiveTab, isDarkMode, toggleDarkMode, children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, role, can, unread, logout } = useAccess();
  const { theme } = useBranding();
  const [query, setQuery] = useState('');
  const visibleItems = menuItems.filter((m) => can(m.id, 'read'));
  const bottomItems = visibleItems
    .filter((m) => ['dashboard', 'employees', 'attendance', 'payroll', 'ai-assistant', 'performance', 'settings'].includes(m.id))
    .slice(0, 5);
  const pageTitle = menuItems.find((m) => m.id === activeTab)?.label ?? 'Dashboard';
  const sidebarFrom = theme.primary || 'var(--sidebar-from, #061a52)';
  const sidebarTo = theme.secondary || 'var(--sidebar-to, #0a2a7a)';
  const sidebarAccent = theme.accent || 'var(--sidebar-accent, #3cd0f5)';
  const sidebarPanelStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(180deg, ${sidebarFrom} 0%, ${sidebarTo} 100%)`,
  };

  const go = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-svh w-full flex bg-gradient-to-br from-background via-background to-secondary/10">
      {/* Desktop / tablet sidebar — theme-driven colors from Admin branding */}
      <aside
        className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col sticky top-0 h-svh border-r border-white/10 text-white z-30"
        style={sidebarPanelStyle}
        aria-label="Primary"
      >
        <div className="p-5 lg:p-6 border-b border-white/10 shrink-0">
          <BrandLockup onDark />
        </div>
        <div className="p-3 lg:p-4 flex-1 overflow-y-auto min-h-0">
          <NavList
            items={visibleItems}
            activeTab={activeTab}
            onSelect={go}
            onDark
            accent={sidebarAccent}
          />
        </div>
        <SidebarCopyright onDark />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-svh">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-3 sm:px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(18rem,85vw)] p-0 border-0 text-white flex flex-col" style={sidebarPanelStyle}>
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <div className="p-5 border-b border-white/10 shrink-0">
                  <BrandLockup onDark />
                </div>
                <div className="p-3 overflow-y-auto flex-1 min-h-0">
                  <NavList
                    items={visibleItems}
                    activeTab={activeTab}
                    onSelect={go}
                    onDark
                    accent={sidebarAccent}
                  />
                </div>
                <SidebarCopyright onDark />
              </SheetContent>
            </Sheet>

            <h1 className="text-base sm:text-lg lg:text-xl font-medium truncate shrink-0 max-w-[40%] sm:max-w-none">
              {pageTitle}
            </h1>

            <div className="flex-1 min-w-0 hidden sm:flex justify-center px-2">
              <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2 w-full max-w-md">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  aria-label="Global search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !query.trim()) return;
                    if (!can('employees', 'read')) {
                      toast.info('Search is limited to modules you can access.');
                      return;
                    }
                    sessionStorage.setItem('global-search', query.trim());
                    window.dispatchEvent(new CustomEvent('global-search', { detail: query.trim() }));
                    setActiveTab('employees');
                    setQuery('');
                  }}
                  placeholder={can('employees', 'read') ? 'Search employees (Enter)…' : 'Search…'}
                  className="bg-transparent border-none outline-none text-sm flex-1 min-w-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
              <div className="hidden xs:flex sm:flex items-center gap-1.5">
                <Sun className="w-4 h-4 hidden sm:block" />
                <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} aria-label="Toggle dark mode" />
                <Moon className="w-4 h-4 hidden sm:block" />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={`Notifications, ${unread} unread`}
                onClick={() => setActiveTab('notifications')}
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] leading-4 text-white text-center">
                    {unread}
                  </span>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 ring-primary"
                    aria-label="Account menu"
                  >
                    <Avatar className="ring-2 ring-primary/20 size-8 sm:size-9">
                      <AvatarImage src={alviProfile} />
                      <AvatarFallback>{user?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:block text-left leading-tight">
                      <span className="block text-sm font-medium">{user?.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{roleLabels[role].label}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="font-medium">{user?.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void logout()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile search row */}
          <div className="sm:hidden mt-2">
            <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                aria-label="Global search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !query.trim()) return;
                  if (!can('employees', 'read')) {
                    toast.info('Search is limited to modules you can access.');
                    return;
                  }
                  sessionStorage.setItem('global-search', query.trim());
                  window.dispatchEvent(new CustomEvent('global-search', { detail: query.trim() }));
                  setActiveTab('employees');
                  setQuery('');
                }}
                placeholder={can('employees', 'read') ? 'Search…' : 'Search…'}
                className="bg-transparent border-none outline-none text-sm flex-1 min-w-0"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 w-full min-w-0 p-3 sm:p-4 lg:p-6 pb-24 md:pb-6 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile"
        >
          <ul className="flex justify-around">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id} className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex flex-col items-center gap-0.5 py-2 text-[10px] sm:text-[11px] truncate ${
                      isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="truncate max-w-full px-0.5">{item.label.split(' ')[0]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

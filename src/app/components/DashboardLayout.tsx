import React, { useState } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import { Switch } from './ui/switch';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { toast } from 'sonner';
import { useAccess, roleLabels } from '../lib/access';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BrandLockup } from './Brand';
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
  LogOut
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

export function DashboardLayout({ activeTab, setActiveTab, isDarkMode, toggleDarkMode, children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, role, can, unread, logout } = useAccess();
  const [query, setQuery] = useState('');
  const visibleItems = menuItems.filter((m) => can(m.id, 'read'));
  const bottomItems = visibleItems.filter((m) => ['dashboard', 'employees', 'attendance', 'payroll', 'ai-assistant'].includes(m.id)).slice(0, 5);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 flex w-full">
        <Sidebar className="hidden lg:flex border-r border-sidebar-border bg-gradient-to-b from-[#061a52] to-[#0a2a7a] text-white">
          <SidebarHeader className="p-6 border-b border-sidebar-border">
            <BrandLockup onDark />
          </SidebarHeader>
          <SidebarContent className="p-4">
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full justify-start gap-3 transition-all duration-200 ${
                        isActive
                          ? 'bg-primary text-white border-l-2 border-[#3cd0f5] hover:bg-primary hover:text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#7fb2ff]'}`} />
                      <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b border-border bg-card p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0">
                    <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                    <div className="p-6 border-b border-border/50">
                      <BrandLockup />
                    </div>
                    <div className="p-4">
                      <nav className="space-y-2">
                        {visibleItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          return (
                            <Button
                              key={item.id}
                              variant={isActive ? 'secondary' : 'ghost'}
                              className="w-full justify-start gap-3"
                              onClick={() => {
                                setActiveTab(item.id);
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                              {item.label}
                            </Button>
                          );
                        })}
                      </nav>
                    </div>
                  </SheetContent>
                </Sheet>

                <SidebarTrigger className="hidden lg:flex" />

                <div className="flex items-center gap-1 sm:gap-2">
                  <h1 className="text-lg sm:text-xl font-medium whitespace-nowrap truncate">{menuItems.find((m) => m.id === activeTab)?.label ?? 'Dashboard'}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden md:flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2 min-w-64">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    aria-label="Global search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || !query.trim()) return;
                      if (!can('employees', 'read')) { toast.info('Search is limited to modules you can access.'); return; }
                      sessionStorage.setItem('global-search', query.trim());
                      window.dispatchEvent(new CustomEvent('global-search', { detail: query.trim() }));
                      setActiveTab('employees');
                      setQuery('');
                    }}
                    placeholder={can('employees', 'read') ? 'Search employees (Enter)…' : 'Search…'}
                    className="bg-transparent border-none outline-none text-sm flex-1"
                  />
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <Sun className="w-4 h-4" />
                  <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                  <Moon className="w-4 h-4" />
                </div>

                <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`} onClick={() => setActiveTab('notifications')}>
                  <Bell className="w-5 h-5" />
                  {unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] leading-4 text-white text-center">{unread}</span>}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 ring-primary" aria-label="Account menu">
                      <Avatar className="ring-2 ring-primary/20"><AvatarImage src={alviProfile} /><AvatarFallback>{user?.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <span className="hidden md:block text-left leading-tight">
                        <span className="block text-sm font-medium">{user?.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{roleLabels[role].label}</span>
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel><div className="font-medium">{user?.name}</div><div className="text-xs font-normal text-muted-foreground">{user?.email}</div></DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void logout()}><LogOut className="w-4 h-4 mr-2" />Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-x-hidden overflow-y-auto">
            {children}
          </main>

          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
            <ul className="flex justify-around">
              {bottomItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id} className="flex-1">
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex flex-col items-center gap-1 py-2 text-[11px] ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label.split(' ')[0]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </SidebarProvider>
  );
}
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { Film, Library, Settings, Clapperboard, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster } from './ui/toaster';
import { useAppStore } from '@/stores/appStore';
import { useSettings } from '@/hooks/useApi';

export function AppLayout() {
  const videosCount = useAppStore(s => s.videos.length);
  const settings = useAppStore(s => s.settings);
  const { loading } = useSettings();
  const navigate = useNavigate();

  const navItems = [
    { to: '/create', icon: Film, label: 'Tạo mới' },
    { to: '/library', icon: Library, label: 'Thư viện' },
    { to: '/settings', icon: Settings, label: 'Cài đặt' },
  ];

  // Wait for the first settings fetch before deciding whether onboarding is needed
  if (loading && !settings.llm.apiKey) {
    return (
      <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center text-[var(--text-muted)]">
        Đang tải...
      </div>
    );
  }

  if (!settings.llm.apiKey) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex h-screen bg-[var(--bg-color)] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--surface-color)] flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-2 font-display text-xl whitespace-nowrap cursor-pointer tracking-wide" onClick={() => navigate('/create')}>
            <Clapperboard className="w-6 h-6 text-[var(--color-primary)]" />
            <span>AUTO NEWS</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 ml-8">Video AI Generator</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/20 dark:hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/settings')}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center text-white font-bold text-xs shrink-0">
              M
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">My Channel</p>
              <p className="text-xs text-[var(--text-muted)]">{videosCount} video đã tạo</p>
            </div>
          </div>
          <div className="mt-2 text-center">
             <button onClick={() => navigate('/health')} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline underline-offset-2">Lỗi & Trạng thái hệ thống</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-[var(--border-color)] bg-[var(--surface-color)]/50 backdrop-blur flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span>Workspace</span>
            <span className="text-[var(--border-color)]">/</span>
            <span className="text-[var(--text-primary)] font-medium">Bảng điều khiển</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              onClick={() => document.documentElement.classList.toggle('dark')}
              title="Đổi giao diện Sáng/Tối"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            </button>
            <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-primary)]"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative noise-bg">
          <div className="max-w-[1440px] mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
      
      <Toaster />
    </div>
  );
}

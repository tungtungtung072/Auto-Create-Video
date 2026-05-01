import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, MoreVertical, Play, Clock, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLibrary } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function LibraryPage() {
  const navigate = useNavigate();
  const { videos } = useLibrary();
  const [search, setSearch] = useState('');

  const filtered = videos.filter(v => v.title.toLowerCase().includes(search.toLowerCase()));

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getRelativeTime = (isoString: string) => {
    const min = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    return `${Math.floor(hr / 24)} ngày trước`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-display uppercase tracking-wide">Thư Viện</h1>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Tìm theo tiêu đề..." 
            className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" /> Lọc
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-[var(--border-color)] rounded-xl">
          <div className="w-16 h-16 rounded-full bg-[var(--surface-color)] flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
             <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium mb-2">Chưa có video nào.</h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">Bạn chưa tạo video nào hoặc không tìm thấy kết quả.</p>
          <Button onClick={() => navigate('/create')}>Tạo video đầu tiên</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filtered.map(vid => (
              <motion.div 
                key={vid.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={() => navigate(`/library/${vid.id}`)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black border border-[var(--border-color)] group-hover:border-[var(--color-primary)] transition-colors mb-3">
                  <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Hover overlay play */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center pl-1 shadow-xl">
                      <Play className="w-5 h-5" fill="currentColor" />
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="absolute bottom-2 right-2 flex gap-2">
                     <span className="bg-black/80 backdrop-blur text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                       {formatDuration(vid.durationSec)}
                     </span>
                  </div>
                  
                  <div className="absolute top-2 right-2">
                     <span className={cn(
                       "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow",
                       vid.status === 'done' ? "bg-[var(--color-success)] text-black" : "bg-[var(--color-warning)] text-black"
                     )}>
                       {vid.status === 'done' ? 'Ready' : vid.status}
                     </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-2 leading-snug mb-1 group-hover:text-[var(--color-primary)] transition-colors">{vid.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] truncate flex items-center justify-between">
                      <span>{vid.sourceDomain}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{getRelativeTime(vid.createdAt)}</span>
                    </p>
                  </div>
                  <button className="text-[var(--text-muted)] hover:text-white p-1" onClick={e => e.stopPropagation()}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

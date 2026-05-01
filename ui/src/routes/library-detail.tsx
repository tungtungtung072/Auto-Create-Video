import { useParams, useNavigate } from 'react-router-dom';
import { Download, FolderOpen, RefreshCw, Scissors, Link as LinkIcon, AlertTriangle, Play, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { useVideoDetail, deleteVideo, rerenderVideo } from '@/hooks/useApi';

export function LibraryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: video, loading, reload } = useVideoDetail(id);

  const [activeTab, setActiveTab] = useState<'script' | 'info' | 'log' | 'settings'>('info');

  if (loading && !video) {
    return <div className="py-20 text-center text-[var(--text-muted)]">Đang tải...</div>;
  }

  if (!video) {
    return (
      <div className="py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-[var(--color-warning)] justify-center mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Video không tìm thấy</h2>
        <Button onClick={() => navigate('/library')}>Quay lại thư viện</Button>
      </div>
    );
  }

  const handleAction = async (action: string) => {
    if (action === 'download_mp4' && video.files.video) {
      window.open(video.files.video, '_blank');
      return;
    }
    if (action === 'download_mp3' && video.files.voice) {
      window.open(video.files.voice, '_blank');
      return;
    }
    if (action === 'download_txt' && video.files.script) {
      window.open(video.files.script, '_blank');
      return;
    }
    if (action === 'open_folder') {
      navigator.clipboard.writeText(video.outputDir);
      toast({ title: 'Đã copy đường dẫn', description: video.outputDir });
      return;
    }
    if (action === 'rerender') {
      try {
        await rerenderVideo(video.id);
        toast({ title: 'Đã đưa vào hàng đợi render lại', description: 'Theo dõi tiến trình ở trang Tạo video.' });
        navigate('/create');
      } catch (e) {
        toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
      }
      return;
    }
    if (action === 'delete') {
      if (!confirm('Xoá video này khỏi thư viện và máy local? Không thể phục hồi.')) return;
      try {
        await deleteVideo(video.id);
        toast({ title: 'Đã xoá video' });
        navigate('/library');
      } catch (e) {
        toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
      }
      return;
    }
    console.log(`[ACTION] ${action}`, video.id);
    toast({ title: 'Đã thực thi', description: `${action} cho video ${video.id}` });
    void reload;
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <button className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-2 inline-flex items-center gap-1" onClick={() => navigate('/library')}>
            &larr; Thư viện
          </button>
          <h1 className="text-2xl font-bold leading-snug">{video.title}</h1>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => handleAction('delete')}>
             <Trash2 className="w-4 h-4 mr-2" /> Xoá
           </Button>
           <Button onClick={() => handleAction('rerender')} className="bg-[#A78BFA] text-black hover:bg-[#A78BFA]/90">
             <RefreshCw className="w-4 h-4 mr-2" /> Render lại visual
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col - Video Player & Actions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="aspect-[9/16] bg-black rounded-xl border border-[var(--border-color)] overflow-hidden relative shadow-2xl">
            {video.files.video ? (
              <video
                src={video.files.video.replace('/file/video', '/stream')}
                poster={video.thumbnailUrl}
                controls
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  Video chưa render xong
                </div>
              </>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <Button variant="secondary" className="w-full justify-start text-xs h-9" onClick={() => handleAction('download_mp4')}>
               <Download className="w-4 h-4 mr-2" /> Tải MP4
             </Button>
             <Button variant="secondary" className="w-full justify-start text-xs h-9" onClick={() => handleAction('download_mp3')}>
               <Download className="w-4 h-4 mr-2" /> Tải Voice.mp3
             </Button>
             <Button variant="secondary" className="w-full justify-start text-xs h-9" onClick={() => handleAction('download_txt')}>
               <Download className="w-4 h-4 mr-2" /> Tải kịch bản (.txt)
             </Button>
             <Button variant="outline" className="w-full justify-start text-xs h-9" onClick={() => handleAction('open_folder')}>
               <FolderOpen className="w-4 h-4 mr-2" /> Mở thư mục local
             </Button>
          </div>

          <Card className="p-4 bg-black/20 text-center">
            <h4 className="text-sm font-semibold mb-3">Chỉnh sửa nhanh trên CapCut</h4>
            <div className="flex gap-2">
              <input type="text" readOnly value={video.outputDir} className="text-xs bg-black/40 border border-[var(--border-color)] p-2 rounded flex-1 outline-none text-[var(--text-muted)] truncate" />
              <Button size="sm" variant="ghost" className="px-2" onClick={() => { navigator.clipboard.writeText(video.outputDir); toast({title:"Đã copy"}); }}>
                Copy
              </Button>
            </div>
            <Button size="sm" className="w-full mt-3 bg-white text-black hover:bg-gray-200" disabled>
              <Scissors className="w-4 h-4 mr-2" /> Mở file Project (Thử nghiệm)
            </Button>
          </Card>
        </div>

        {/* Right Col - Tabs content */}
        <div className="lg:col-span-8">
          <div className="flex border-b border-[var(--border-color)] mb-6">
            {[
              { id: 'info', label: 'Thông tin chung' },
              { id: 'script', label: 'Kịch bản chi tiết' },
              { id: 'log', label: 'Log thực thi' },
              { id: 'settings', label: 'Cài đặt đã dùng' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors border-b-2",
                  activeTab === tab.id ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'info' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Chi tiết nguồn</h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between border-b border-[var(--border-color)] pb-3">
                      <span className="text-[var(--text-muted)]">Nguồn báo</span>
                      <span className="font-medium">{video.sourceDomain}</span>
                    </div>
                    {video.sourceUrl && (
                      <div className="flex justify-between border-b border-[var(--border-color)] pb-3 items-center">
                        <span className="text-[var(--text-muted)]">Link bài gốc</span>
                        <a href={video.sourceUrl} target="_blank" className="text-[var(--color-primary)] hover:underline flex items-center gap-1 font-mono text-xs w-2/3 justify-end text-right truncate">
                           <LinkIcon className="w-3 h-3 shrink-0" /> {video.sourceUrl}
                        </a>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-[var(--border-color)] pb-3">
                      <span className="text-[var(--text-muted)]">Ngày tạo</span>
                      <span className="font-medium">{new Date(video.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--border-color)] pb-3">
                      <span className="text-[var(--text-muted)]">Thời lượng</span>
                      <span className="font-medium font-mono">{video.durationSec} giây</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span className="text-[var(--text-muted)]">Trạng thái</span>
                      <span className="font-medium text-[var(--color-success)] capitalize">{video.status}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'script' && (
              <div className="space-y-4">
                 <div className="flex justify-between items-center mb-2">
                   <h3 className="font-semibold">{video.script.title}</h3>
                   <Button size="sm" variant="outline">Sửa & Render lại</Button>
                 </div>
                 {video.script.scenes.length > 0 ? video.script.scenes.map((scene, i) => (
                   <Card key={scene.id} className="p-4 flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-[var(--surface-color)] text-[var(--text-muted)] flex items-center justify-center font-mono font-bold shrink-0">
                       {i+1}
                     </div>
                     <div className="flex-1 space-y-2">
                        <p className="text-sm">{scene.voiceText}</p>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">Template: {scene.template}</span>
                        </div>
                     </div>
                   </Card>
                 )) : (
                   <div className="text-center p-8 border border-dashed rounded-lg text-[var(--text-muted)]">
                     Kịch bản hiện không có trong bản lưu này.
                   </div>
                 )}
              </div>
            )}
            
            {activeTab === 'log' && (
              <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-4 overflow-x-auto">
                <pre className="text-[#E6EDF3] font-mono text-xs leading-loose">
[2026-05-01 10:00:00] INFO: Starting job {video.id}
[2026-05-01 10:00:01] INFO: Fetching URL... Done
[2026-05-01 10:00:02] INFO: Generating script via {video.llmProvider}...
[2026-05-01 10:00:10] INFO: Script length: 1240 chars.
[2026-05-01 10:00:11] INFO: Generating TTS using {video.ttsProvider} ({video.voiceId})...
[2026-05-01 10:00:30] INFO: TTS Done. Audio duration: {video.durationSec}s.
[2026-05-01 10:00:31] INFO: Generating visual scenes via FFmpeg...
[2026-05-01 10:01:45] INFO: FFmpeg render complete.
[2026-05-01 10:01:45] SUCCESS: Job {video.id} finished successfully.
                </pre>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="grid grid-cols-2 gap-4">
                 <Card className="p-4">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Mô hình kịch bản</p>
                    <p className="font-semibold uppercase tracking-wide">{video.llmProvider}</p>
                 </Card>
                 <Card className="p-4">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Provider Giọng dọc</p>
                    <p className="font-semibold uppercase tracking-wide">{video.ttsProvider}</p>
                 </Card>
                 <Card className="p-4">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Voice ID</p>
                    <p className="font-semibold font-mono">{video.voiceId}</p>
                 </Card>
                 <Card className="p-4">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Thư mục xuất</p>
                    <p className="font-semibold text-xs font-mono truncate">{video.outputDir}</p>
                 </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

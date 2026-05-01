import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, FileText, Settings2, Play, CircleSlash, Loader2, CheckCircle2, AlertCircle, MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateJob, useApproveScript, useCancelJob } from '@/hooks/useApi';
import { useAppStore } from '@/stores/appStore';
import { ScriptDoc } from '@/types/api';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'motion/react';

export function CreatePage() {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tone, setTone] = useState('energetic');
  
  const { currentJob, setCurrentJob } = useAppStore();
  const { mutate, isPending } = useCreateJob();
  const approveScript = useApproveScript();
  const cancelJob = useCancelJob();
  
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [currentJob?.logLines]);

  const handleCreate = () => {
    mutate({
      source: mode === 'url' ? { kind: 'url', url } : { kind: 'text', title: 'Bài viết tự nhập', content: text },
      options: { tone: tone as any }
    });
  };

  const handleApprove = async () => {
    if (!currentJob) return;
    try {
      await approveScript(currentJob.id, currentJob.script);
      toast({ title: 'Đã duyệt kịch bản', description: 'Đang tiếp tục tạo giọng đọc...' });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    if (!currentJob) return;
    if (!confirm('Hủy job hiện tại?')) return;
    try {
      await cancelJob(currentJob.id);
      setCurrentJob(null);
    } catch {}
  };

  const getStatusIcon = (stepStatus: 'pending' | 'running' | 'done' | 'error') => {
    if (stepStatus === 'done') return <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />;
    if (stepStatus === 'running') return <Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" />;
    if (stepStatus === 'error') return <AlertCircle className="w-5 h-5 text-[var(--color-danger)]" />;
    return <CircleSlash className="w-5 h-5 text-[var(--border-color)]" />;
  };

  const STEPS = [
    'Đọc URL', 'Viết kịch bản', 'Tải ảnh', 'Đọc giọng',
    'Trộn nhạc nền', 'Dựng cảnh', 'Render video', 'Hoàn tất'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {currentJob?.status === 'done' && (
        <div className="lg:col-span-5">
          <Card className="p-4 bg-[var(--color-success)]/10 border-[var(--color-success)] flex justify-between items-center">
            <div>
              <p className="font-semibold">Video đã hoàn tất!</p>
              <p className="text-sm text-[var(--text-muted)]">Mở thư viện để xem hoặc tải xuống.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentJob(null)}>Tạo video khác</Button>
              <Button onClick={() => { if (currentJob.videoId) window.location.href = `/library/${currentJob.videoId}`; }}>
                Mở video
              </Button>
            </div>
          </Card>
        </div>
      )}
      {/* Left Column - Input Form */}
      <div className="lg:col-span-3 space-y-6">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-wide mb-2">Tạo Video Mới</h1>
          <p className="text-[var(--text-muted)]">Biến bài báo thành video ngắn chỉ với một cú nhấp chuột.</p>
        </div>

        <Card className="overflow-hidden">
          <div className="flex border-b border-[var(--border-color)]">
            <button 
              className={cn("flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors", mode === 'url' ? "border-b-2 border-[var(--color-primary)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-black/10")}
              onClick={() => setMode('url')}
            >
              <Link2 className="w-4 h-4" /> Từ URL bài báo
            </button>
            <button 
              className={cn("flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors", mode === 'text' ? "border-b-2 border-[var(--color-primary)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-black/10")}
              onClick={() => setMode('text')}
            >
              <FileText className="w-4 h-4" /> Từ file văn bản
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'url' ? (
                <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Đường dẫn bài báo</label>
                    <input 
                      type="url"
                      placeholder="VD: https://vnexpress.net/..."
                      className="w-full bg-black/20 border border-[var(--border-color)] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-2">Ví dụ (click để thử):</p>
                    <div className="flex flex-wrap gap-2">
                      {['vnexpress.net', 'dantri.com.vn', 'genk.vn', 'tinhte.vn'].map(domain => (
                        <button 
                          key={domain}
                          className="px-3 py-1 rounded-full text-xs border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
                          onClick={() => setUrl(`https://${domain}/giai-tri/tin-tuc-mau-123.html`)}
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all">
                    <FileText className="w-10 h-10 text-[var(--text-muted)] mb-4" />
                    <p className="font-medium mb-1">Kéo thả file .txt vào đây</p>
                    <p className="text-xs text-[var(--text-muted)]">hoặc click để chọn file từ máy</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Advanced Settings */}
            <div className="border-t border-[var(--border-color)] pt-4">
              <button 
                className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings2 className="w-4 h-4" /> Tuỳ chỉnh nâng cao
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 pb-2 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Tone giọng</label>
                        <div className="flex gap-2">
                          {[
                            { id: 'energetic', label: 'Năng động' },
                            { id: 'formal', label: 'Trang trọng' },
                            { id: 'humorous', label: 'Hài hước' },
                            { id: 'analytical', label: 'Phân tích' }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setTone(t.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                                tone === t.id 
                                  ? "bg-[var(--color-primary)]/20 border-[var(--color-primary)] text-[var(--color-primary)]" 
                                  : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="flex justify-between text-sm font-medium mb-2">
                              <span>Số cảnh mong muốn</span>
                              <span className="text-[var(--color-primary)]">6</span>
                            </label>
                            <input type="range" min="4" max="8" defaultValue="6" className="w-full accent-[var(--color-primary)]" />
                         </div>
                         <div>
                            <label className="flex justify-between text-sm font-medium mb-2">
                              <span>Thời lượng</span>
                              <span className="text-[var(--color-primary)]">60s</span>
                            </label>
                            <input type="range" min="45" max="90" defaultValue="60" className="w-full accent-[var(--color-primary)]" />
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button 
              className="w-full text-lg h-14" 
              onClick={handleCreate}
              disabled={(!url && !text) || isPending || !!currentJob}
            >
              {isPending || (currentJob && currentJob.status !== 'done') ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Đang xử lý...</>
              ) : (
                <><Play className="w-5 h-5 mr-2" fill="currentColor" /> Tạo video</>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right Column - Preview/Progress */}
      <div className="lg:col-span-2">
        {!currentJob ? (
          <Card className="h-full bg-black/20 border-dashed border-[var(--border-color)]">
            <div className="p-8 flex flex-col items-center justify-center text-center h-full text-[var(--text-muted)]">
              <div className="w-16 h-16 rounded-full bg-[var(--surface-color)] flex items-center justify-center mb-6">
                 <MonitorPlay className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Cách hoạt động</h3>
              <p className="text-sm mb-8">Video sẽ tự động trải qua 4 giai đoạn:</p>
              
              <div className="space-y-4 w-full max-w-[200px] text-left mx-auto">
                {['Đọc bài viết', 'Viết kịch bản', 'Thu âm giọng đọc', 'Dựng video & hiệu ứng'].map((step, i) => (
                  <div key={i} className="flex gap-3 items-center text-sm">
                    <span className="w-6 h-6 rounded-full bg-[var(--surface-color)] text-[var(--color-primary)] flex items-center justify-center text-xs font-mono">{i+1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col h-[600px]">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="font-semibold">Tiến trình</h3>
              <span className="text-xs font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-1 rounded">
                ETA: 02:30
              </span>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto" ref={logRef}>
              <div className="space-y-4 relative">
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-[var(--border-color)]" />
                
                {STEPS.map((stepName, index) => {
                  const stepNumber = index + 1;
                  let st: 'pending'|'running'|'done'|'error' = 'pending';
                  if (currentJob.currentStep > stepNumber || currentJob.status === 'done') st = 'done';
                  else if (currentJob.currentStep === stepNumber) st = currentJob.status === 'error' ? 'error' : 'running';
                  
                  return (
                    <div key={index} className="flex gap-4 relative z-10">
                      <div className="mt-0.5 bg-[var(--surface-color)] rounded-full">{getStatusIcon(st)}</div>
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", st === 'done' ? "text-[var(--text-primary)]" : st === 'running' ? "text-[var(--color-primary)]" : "text-[var(--text-muted)]")}>
                          {stepName}
                        </p>
                        
                        {/* Inline Review Modal Simulation */}
                        {currentJob.status === 'review' && stepNumber === 2 && currentJob.script && (
                          <div className="mt-3 p-3 border border-[var(--color-warning)] bg-[var(--color-warning)]/5 rounded-lg">
                            <p className="text-xs text-[var(--color-warning)] mb-2 font-bold uppercase tracking-wide">Xem lại kịch bản</p>
                            <div className="space-y-2 mb-3">
                              {currentJob.script.scenes.map(s => (
                                <div key={s.id} className="text-xs bg-[var(--surface-color)] p-2 rounded">
                                  <span className="opacity-50 inline-block w-4">{s.id}.</span> {s.voiceText}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleCancel}>Hủy</Button>
                              <Button size="sm" className="flex-1 text-xs h-7" onClick={handleApprove}>Duyệt &amp; tiếp tục</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="p-4 bg-black/40 border-t border-[var(--border-color)] h-32 overflow-hidden flex flex-col font-mono text-xs">
              <div className="text-[#A78BFA] mb-1 font-bold">Terminal logs</div>
              <div className="flex-1 overflow-y-auto text-gray-400 leading-relaxed pr-2" ref={logRef}>
                {currentJob.logLines?.map((line, i) => (
                  <div key={i}><span className="text-gray-600 mr-2">{new Date().toISOString().substring(11, 19)}</span>{line}</div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

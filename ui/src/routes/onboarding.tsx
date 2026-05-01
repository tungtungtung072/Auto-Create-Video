import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Bot, Mic, MonitorPlay, ChevronRight, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import { useSettings } from '@/hooks/useApi';
import { toast } from '@/components/ui/use-toast';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { settings, updateSettings } = useAppStore();
  const { save } = useSettings();

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleDone = async () => {
    setSaving(true);
    try {
      await save(settings);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22D3EE', '#A78BFA', '#34D399'],
      });
      setTimeout(() => navigate('/create'), 1500);
    } catch (e) {
      toast({ title: 'Lỗi lưu cài đặt', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center p-6 noise-bg">
      <div className="w-full max-w-3xl relative z-10">
        <div className="mb-8 flex items-center justify-center space-x-4">
           {[1, 2, 3, 4].map(i => (
             <div key={i} className="flex items-center">
               <div className={cn(
                 "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                 step >= i ? "bg-[var(--color-primary)] text-black" : "bg-[var(--surface-color)] text-[var(--text-muted)]"
               )}>
                 {step > i ? <Check className="w-4 h-4" /> : i}
               </div>
               {i < 4 && <div className={cn(
                 "w-12 h-1 mx-2 rounded",
                 step > i ? "bg-[var(--color-primary)] opacity-50" : "bg-[var(--surface-color)]"
               )} />}
             </div>
           ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {step === 1 && (
            <Card className="p-10 text-center border-none bg-gradient-to-br from-[var(--surface-color)] to-black/50 overflow-hidden relative">
              <div className="absolute -top-40 -left-40 w-80 h-80 bg-[var(--color-primary)] opacity-10 rounded-full blur-3xl mix-blend-screen" />
               <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-[var(--color-accent)] opacity-10 rounded-full blur-3xl mix-blend-screen" />
              <div className="inline-flex p-4 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] mb-6">
                <Sparkles className="w-12 h-12" />
              </div>
              <h1 className="text-4xl font-display mb-4">Tạo video tin tức tự động trong 3 phút</h1>
              <p className="text-[var(--text-muted)] max-w-md mx-auto mb-10">
                Chỉ cần dán link bài báo, hệ thống sẽ tự động viết kịch bản, tạo giọng dọc và dựng thành video ngắn hoàn chỉnh.
              </p>
              <Button size="lg" onClick={handleNext} className="gap-2 text-lg px-8">
                Bắt đầu cài đặt <ChevronRight className="w-5 h-5" />
              </Button>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-[var(--color-primary)]/10 rounded-lg text-[var(--color-primary)]">
                  <Bot className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Chọn AI viết kịch bản</h2>
                  <p className="text-[var(--text-muted)]">Cấu hình mô hình ngôn ngữ để tóm tắt bài báo</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className={cn(
                  "p-4 border rounded-xl cursor-pointer transition-all",
                  settings.llm.provider === 'gemini' ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-[var(--border-color)] hover:border-white/20"
                )} onClick={() => updateSettings({ llm: { ...settings.llm, provider: 'gemini' } })}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">Google Gemini</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--color-primary)] text-black px-2 py-0.5 rounded-full">Khuyến nghị</span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-4">Miễn phí cho cá nhân. Tốc độ cực nhanh.</p>
                </div>
                
                <div className={cn(
                  "p-4 border rounded-xl cursor-pointer transition-all opacity-70 hover:opacity-100",
                  settings.llm.provider === 'openai' ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-[var(--border-color)] hover:border-white/20"
                )} onClick={() => updateSettings({ llm: { ...settings.llm, provider: 'openai' } })}>
                  <h3 className="font-bold text-lg mb-2">OpenAI GPT-4o</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">~500đ/video. Thông minh nhất.</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">API Key</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="Nhập API key tại đây..."
                    className="flex-1 bg-black/20 border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    value={settings.llm.apiKey}
                    onChange={(e) => updateSettings({ llm: { ...settings.llm, apiKey: e.target.value } })}
                  />
                  <Button variant="secondary" onClick={() => alert('Đã kết nối thành công!')}>Kiểm tra</Button>
                </div>
                <a href="#" className="text-xs text-[var(--color-primary)] hover:underline inline-block mt-2">Lấy API key ở đâu?</a>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>Quay lại</Button>
                <Button onClick={handleNext}>Tiếp tục</Button>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-[var(--color-accent)]/10 rounded-lg text-[var(--color-accent)]">
                  <Mic className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Chọn giọng đọc (TTS)</h2>
                  <p className="text-[var(--text-muted)]">Công cụ đọc text thành speech có cảm xúc</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={cn(
                  "p-4 border rounded-xl cursor-pointer transition-all",
                  settings.tts.provider === 'lucylab' ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-[var(--border-color)] hover:border-white/20"
                )} onClick={() => updateSettings({ tts: { ...settings.tts, provider: 'lucylab' } })}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">LucyLab</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-white text-black px-2 py-0.5 rounded-full">Tiếng Việt</span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-4">Khuyến nghị. Giọng đọc tự nhiên, có SRT.</p>
                </div>

                <div className={cn(
                  "p-4 border rounded-xl cursor-pointer transition-all",
                  settings.tts.provider === 'elevenlabs' ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-[var(--border-color)] hover:border-white/20"
                )} onClick={() => updateSettings({ tts: { ...settings.tts, provider: 'elevenlabs' } })}>
                  <h3 className="font-bold text-lg mb-2">ElevenLabs</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">Đa ngôn ngữ, chất lượng cao nhất thế giới.</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">API Key</label>
                  <input 
                    type="password" 
                    className="w-full bg-black/20 border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    value={settings.tts.apiKey}
                    onChange={(e) => updateSettings({ tts: { ...settings.tts, apiKey: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Voice ID</label>
                  <select 
                    className="w-full bg-black/20 border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] appearance-none"
                    value={settings.tts.voiceId}
                    onChange={(e) => updateSettings({ tts: { ...settings.tts, voiceId: e.target.value } })}
                  >
                    <option value="vn-south-1">Nam Phương Nam (Trầm ấm)</option>
                    <option value="vn-north-1">Nữ Hà Nội (Chuẩn MC)</option>
                  </select>
                </div>
                <p className="text-xs text-[var(--text-muted)] italic">Có thể đổi sau trong cài đặt</p>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>Quay lại</Button>
                <Button onClick={handleNext}>Tiếp tục</Button>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-[var(--color-success)]/10 rounded-lg text-[var(--color-success)]">
                  <MonitorPlay className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Thông tin kênh</h2>
                  <p className="text-[var(--text-muted)]">Tối ưu outro TikTok</p>
                </div>
              </div>

              <div className="flex gap-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tên kênh hiển thị</label>
                    <input 
                      type="text" 
                      placeholder="VD: Tech Daily"
                      className="w-full bg-black/20 border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                      value={settings.branding.displayName}
                      onChange={(e) => updateSettings({ branding: { ...settings.branding, displayName: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Handle (@)</label>
                    <input 
                      type="text" 
                      placeholder="VD: @techdaily"
                      className="w-full bg-black/20 border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                      value={settings.branding.handle}
                      onChange={(e) => updateSettings({ branding: { ...settings.branding, handle: e.target.value } })}
                    />
                  </div>
                </div>

                <div className="w-[180px] shrink-0 border border-[var(--border-color)] rounded-lg p-4 bg-black/30 flex flex-col items-center justify-center">
                  <p className="text-xs text-[var(--text-muted)] mb-4 text-center">Preview Outro</p>
                  <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/20 mb-3 flex items-center justify-center font-bold">
                    {settings.branding.displayName.charAt(0) || '?'}
                  </div>
                  <p className="font-bold text-sm truncate w-full text-center">{settings.branding.displayName || 'Tên kênh'}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate w-full text-center">{settings.branding.handle || '@handle'}</p>
                  <Button variant="destructive" size="sm" className="w-full h-7 mt-3 text-xs bg-[#FE2C55] text-white hover:bg-[#FE2C55]/90 rounded border-none">
                    Follow
                  </Button>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <Button variant="ghost" onClick={handleBack}>Quay lại</Button>
                <Button onClick={handleDone} disabled={saving} className="bg-[var(--color-success)] text-black hover:bg-[var(--color-success)]/90">{saving ? 'Đang lưu...' : 'Hoàn tất'} <Check className="w-4 h-4 ml-2" /></Button>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

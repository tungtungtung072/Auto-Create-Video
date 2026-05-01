import { useState, useEffect, type ChangeEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/components/ui/use-toast';
import { LlmProvider, TtsProvider } from '@/types/api';
import { useSettings } from '@/hooks/useApi';

export function SettingsPage() {
  const { settings } = useAppStore();
  const { save, test } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when store changes
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Strip masked values so server doesn't overwrite real keys with ••••
      const patch = JSON.parse(JSON.stringify(localSettings)) as typeof localSettings;
      if (/^•+/.test(patch.llm.apiKey)) patch.llm.apiKey = '';
      if (/^•+/.test(patch.tts.apiKey)) patch.tts.apiKey = '';
      // Only send fields that actually changed
      await save(patch);
      toast({ title: 'Đã lưu cài đặt', description: 'Cấu hình của bạn đã được cập nhật.' });
    } catch (e) {
      toast({ title: 'Lỗi lưu cài đặt', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (kind: 'llm' | 'tts') => {
    try {
      // Save first so we test against the actual stored value
      await save(localSettings);
      const r = await test(kind);
      if (r.ok) toast({ title: 'Kết nối thành công' });
      else toast({ title: 'Lỗi kết nối', description: r.reason ?? 'Không xác định', variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleLlmProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setLocalSettings({ ...localSettings, llm: { ...localSettings.llm, provider: e.target.value as LlmProvider } });
  };
  const handleTtsProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setLocalSettings({ ...localSettings, tts: { ...localSettings.tts, provider: e.target.value as TtsProvider } });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-wide mb-2">Cài Đặt</h1>
          <p className="text-[var(--text-muted)] text-sm">Quản lý API, cấu hình render và thương hiệu kênh.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="w-4 h-4" /> {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2"><span className="w-8 h-8 rounded bg-[var(--surface-color)] flex items-center justify-center text-[var(--color-primary)]">1</span> AI Viết Kịch Bản</h2>
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nhà cung cấp (Provider)</label>
              <select className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2" value={localSettings.llm.provider} onChange={handleLlmProviderChange}>
                <option value="gemini">Google Gemini (Miễn phí)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="ollama">Ollama (Chạy offline)</option>
              </select>
            </div>
            <div>
               <label className="block text-sm font-medium mb-2">API Key</label>
               <input type="password" placeholder="sk-..." className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2" value={localSettings.llm.apiKey} onChange={e => setLocalSettings({...localSettings, llm: {...localSettings.llm, apiKey: e.target.value}})} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
             <Button variant="secondary" size="sm" onClick={() => handleTest('llm')}>Test Connection</Button>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2"><span className="w-8 h-8 rounded bg-[var(--surface-color)] flex items-center justify-center text-[var(--color-accent)]">2</span> Giọng Đọc (TTS)</h2>
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nhà cung cấp</label>
              <select className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2" value={localSettings.tts.provider} onChange={handleTtsProviderChange}>
                <option value="lucylab">LucyLab (Tiếng Việt tốt nhất)</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>
            <div>
               <label className="block text-sm font-medium mb-2">API Key</label>
               <input type="password" placeholder="..." className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2" value={localSettings.tts.apiKey} onChange={e => setLocalSettings({...localSettings, tts: {...localSettings.tts, apiKey: e.target.value}})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Voice ID Mặc Định</label>
            <input type="text" className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2 font-mono text-sm" value={localSettings.tts.voiceId} onChange={e => setLocalSettings({...localSettings, tts: {...localSettings.tts, voiceId: e.target.value}})} />
          </div>
          <div className="bg-[var(--color-warning)]/10 text-[var(--color-warning)] p-3 rounded-lg flex gap-3 text-sm items-start">
             <AlertTriangle className="w-5 h-5 shrink-0" />
             <p>Bạn phải setup API Key của nhà cung cấp trước khi có thể preview giọng.</p>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2"><span className="w-8 h-8 rounded bg-[var(--surface-color)] flex items-center justify-center text-[var(--color-success)]">3</span> Thương Hiệu & Outro</h2>
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tên hiển thị</label>
              <input type="text" placeholder="Tech Daily" className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2" value={localSettings.branding.displayName} onChange={e => setLocalSettings({...localSettings, branding: {...localSettings.branding, displayName: e.target.value}})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Handle TikTok/YouTube</label>
              <input type="text" placeholder="@techdaily" className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2" value={localSettings.branding.handle} onChange={e => setLocalSettings({...localSettings, branding: {...localSettings.branding, handle: e.target.value}})} />
            </div>
          </div>
        </Card>
      </div>
      
       <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2"><span className="w-8 h-8 rounded bg-[var(--surface-color)] flex items-center justify-center text-white">4</span> Tuỳ Chọn Hệ Thống</h2>
        <Card className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Thư mục xuất video (Local)</label>
            <div className="flex gap-2">
              <input type="text" className="flex-1 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-2 font-mono text-sm" value={localSettings.storage.outputDir} onChange={e => setLocalSettings({...localSettings, storage: {...localSettings.storage, outputDir: e.target.value}})} />
              <Button variant="secondary">Browse...</Button>
            </div>
          </div>
          <div>
             <label className="flex items-center gap-2 cursor-pointer">
               <input type="checkbox" checked={localSettings.render.tiktokCardEnabled} onChange={e => setLocalSettings({...localSettings, render: {...localSettings.render, tiktokCardEnabled: e.target.checked}})} className="w-4 h-4 rounded accent-[var(--color-primary)] bg-[var(--surface-color)] border-[var(--border-color)]" />
               <span className="text-sm font-medium">Bật Card Follow Tiktok ở outro</span>
             </label>
          </div>
        </Card>
      </div>

    </div>
  );
}

import { CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useHealth } from '@/hooks/useApi';

export function HealthPage() {
  const navigate = useNavigate();
  const { data, loading, refresh } = useHealth();
  const checks = data?.checks ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end border-b border-[var(--border-color)] pb-4">
        <div>
          <button
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-2 inline-flex items-center gap-1"
            onClick={() => navigate('/settings')}
          >
            &larr; Cài đặt
          </button>
          <h1 className="text-2xl font-bold uppercase tracking-wide">Trạng thái hệ thống</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Kiểm tra lại
        </Button>
      </div>

      {data && (
        <Card className="p-4 bg-black/20">
          <p className="text-xs text-[var(--text-muted)]">
            Thư mục lưu trữ: <span className="font-mono">{data.paths.rootDir}</span>
          </p>
        </Card>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          {checks.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">Đang kiểm tra...</p>
          )}
          {checks.map((check, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                {check.status === 'ok' ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />
                ) : check.status === 'warn' ? (
                  <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-[var(--color-danger)]" />
                )}
                <div>
                  <h4 className="font-semibold">{check.name}</h4>
                  <p className="text-sm text-[var(--text-muted)]">{check.detail}</p>
                  {check.fix && (
                    <p className="text-xs text-[var(--color-primary)] mt-1">{check.fix}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)] mb-2">Auto News Video — Local v1.0</p>
      </div>
    </div>
  );
}

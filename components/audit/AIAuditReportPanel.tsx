'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, RotateCcw, AlertCircle, Download } from 'lucide-react';

interface AuditUser {
  id: string;
  email: string;
  role: string;
}

interface Scope {
  threadCount: number;
  messageCount: number;
  userCount: number;
}

interface AIAuditReportPanelProps {
  token: string;
}

export function AIAuditReportPanel({ token }: AIAuditReportPanelProps) {
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  // Scope preview
  const [scope, setScope] = useState<Scope | null>(null);
  const [loadingScope, setLoadingScope] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Report generation
  const [reportContent, setReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string } | null>(null);

  const reportEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUsers();
  }, [token]);

  useEffect(() => {
    if (isGenerating && reportEndRef.current) {
      reportEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [reportContent, isGenerating]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/audit/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleGenerateClick = async () => {
    if (!dateFrom || !dateTo) {
      setError('日付範囲を指定してください');
      return;
    }
    setError(null);
    setLoadingScope(true);

    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (userFilter !== 'all') params.set('userId', userFilter);

      const res = await fetch(`/api/audit/ai-report/scope?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'スコープの取得に失敗しました');
        return;
      }

      const data = await res.json();
      if (data.messageCount === 0) {
        setError('対象期間にチャットデータがありません');
        return;
      }

      setScope(data);
      setConfirmOpen(true);
    } catch (err) {
      setError('スコープの取得中にエラーが発生しました');
    } finally {
      setLoadingScope(false);
    }
  };

  const generateReport = async () => {
    setConfirmOpen(false);
    setIsGenerating(true);
    setReportContent('');
    setError(null);
    setProgress(null);

    try {
      const res = await fetch('/api/audit/ai-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from: dateFrom,
          to: dateTo,
          userId: userFilter !== 'all' ? userFilter : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || 'レポート生成に失敗しました');
        setIsGenerating(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let reportStarted = false;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // バッファから行を処理
        while (buffer.includes('\n')) {
          const newlineIndex = buffer.indexOf('\n');
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith('[PROGRESS]')) {
            // 進捗メッセージ: [PROGRESS]current/total/phase
            const parts = line.slice('[PROGRESS]'.length).split('/');
            setProgress({
              current: parseInt(parts[0], 10),
              total: parseInt(parts[1], 10),
              phase: parts[2] || '',
            });
          } else if (line === '[REPORT]') {
            reportStarted = true;
          } else if (reportStarted) {
            setReportContent(prev => prev + line + '\n');
          }
        }

        // レポート開始後はバッファの残りもリアルタイムで表示
        if (reportStarted && buffer.length > 0) {
          setReportContent(prev => prev + buffer);
          buffer = '';
        }
      }

      // 残りのバッファ
      if (buffer.length > 0 && reportStarted) {
        setReportContent(prev => prev + buffer);
      }
    } catch (err) {
      setError('レポート生成中にエラーが発生しました');
      setReportContent(prev =>
        prev ? prev + '\n\n[レポート生成が中断されました]' : ''
      );
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setUserFilter('all');
    setError(null);
    setReportContent('');
    setScope(null);
    setProgress(null);
  };

  const markdownToHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      // List items
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Paragraphs (double newline)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines
      .replace(/\n/g, '<br/>')
      // Wrap in paragraphs
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  };

  const handleExportWord = () => {
    const htmlBody = markdownToHtml(reportContent);
    const title = `AI監査レポート (${dateFrom} ~ ${dateTo})`;

    const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: 'Yu Gothic', 'Meiryo', sans-serif; font-size: 11pt; line-height: 1.8; color: #333; margin: 2cm; }
  h1 { font-size: 18pt; color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 6pt; margin-top: 24pt; }
  h2 { font-size: 14pt; color: #1a1a2e; border-bottom: 1px solid #d1d5db; padding-bottom: 4pt; margin-top: 20pt; }
  h3 { font-size: 12pt; color: #374151; margin-top: 16pt; }
  li { margin-left: 20pt; margin-bottom: 4pt; }
  b { color: #1a1a2e; }
  p { margin-bottom: 8pt; }
</style>
</head>
<body>
<h1>${title}</h1>
<p style="color:#6b7280;font-size:9pt;">生成日: ${new Date().toLocaleString('ja-JP')}</p>
<hr/>
${htmlBody}
</body>
</html>`.trim();

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI監査レポート_${dateFrom}_${dateTo}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">開始日</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[140px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">終了日</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[140px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">ユーザー</label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isGenerating}
          className="h-8 text-xs bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black transition-all duration-200"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          リセット
        </Button>

        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleGenerateClick}
            disabled={isGenerating || loadingScope}
            className="h-8 text-xs bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black transition-all duration-200"
          >
            {loadingScope ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1" />
            )}
            レポート生成
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Generating indicator */}
      {isGenerating && (
        <div className="px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            <span className="text-sm text-indigo-400">
              {progress?.phase === 'map'
                ? `チャンク分析中... (${progress.current}/${progress.total})`
                : progress?.phase === 'reduce'
                ? 'レポート統合・生成中...'
                : progress?.phase === 'direct'
                ? 'レポート生成中...'
                : 'データ読み込み中...'}
            </span>
          </div>
          {progress?.phase === 'map' && progress.total > 1 && (
            <div className="flex gap-1">
              {Array.from({ length: progress.total }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < progress.current
                      ? 'bg-indigo-500'
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report content */}
      {reportContent && (
        <div className="backdrop-blur-sm bg-gray-800/30 border border-gray-700/30 rounded-xl">
          {/* Export header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <span className="text-xs text-gray-500">
              {isGenerating ? 'レポート生成中...' : 'レポート生成完了'}
            </span>
            {!isGenerating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportWord}
                className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              >
                <Download className="w-3 h-3 mr-1" />
                Word出力
              </Button>
            )}
          </div>
          {/* Scrollable report area */}
          <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-gray-200 leading-relaxed">
              {reportContent}
            </div>
            <div ref={reportEndRef} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!reportContent && !isGenerating && !error && (
        <div className="text-center py-16">
          <Sparkles className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            日付範囲を指定して「レポート生成」をクリックすると、
          </p>
          <p className="text-sm text-gray-500">
            AIがチャット内容を分析し包括的な監査レポートを作成します
          </p>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[400px] p-0 bg-transparent border-none shadow-none">
          <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl p-5 shadow-2xl">
            {/* Icon */}
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
            </div>

            <DialogHeader className="text-center space-y-1.5">
              <DialogTitle className="text-base font-semibold text-gray-100">
                AI監査レポートを生成
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                以下の範囲のチャットデータをAIが分析します
              </DialogDescription>
            </DialogHeader>

            {/* Scope details */}
            {scope && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-800/60 rounded-lg">
                  <span className="text-xs text-gray-400">期間</span>
                  <span className="text-xs text-gray-200 font-mono">{dateFrom} ~ {dateTo}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center px-3 py-2 bg-gray-800/60 rounded-lg">
                    <div className="text-lg font-bold text-indigo-400">{scope.threadCount}</div>
                    <div className="text-xs text-gray-500">スレッド</div>
                  </div>
                  <div className="text-center px-3 py-2 bg-gray-800/60 rounded-lg">
                    <div className="text-lg font-bold text-indigo-400">{scope.messageCount}</div>
                    <div className="text-xs text-gray-500">メッセージ</div>
                  </div>
                  <div className="text-center px-3 py-2 bg-gray-800/60 rounded-lg">
                    <div className="text-lg font-bold text-indigo-400">{scope.userCount}</div>
                    <div className="text-xs text-gray-500">ユーザー</div>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 mt-5">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-10 text-sm text-gray-300 hover:text-gray-100 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl transition-all duration-200"
              >
                キャンセル
              </Button>
              <Button
                onClick={generateReport}
                className="flex-1 h-10 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all duration-200"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                生成する
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

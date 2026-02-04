'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from './Pagination';
import { Loader2, Download, Search, RotateCcw } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string };
}

interface AuditUser {
  id: string;
  email: string;
  role: string;
}

interface OperationLogPanelProps {
  token: string;
}

const ACTION_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  login: { label: 'ログイン', variant: 'default' },
  api_key_change: { label: 'APIキー変更', variant: 'secondary' },
  mode_change: { label: 'モード変更', variant: 'secondary' },
  thread_create: { label: 'スレッド作成', variant: 'outline' },
  thread_delete: { label: 'スレッド削除', variant: 'destructive' },
};

export function OperationLogPanel({ token }: OperationLogPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadUsers();
  }, [token]);

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, userFilter, dateFrom, dateTo]);

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

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (userFilter !== 'all') params.set('userId', userFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/audit/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, userFilter, dateFrom, dateTo, token]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ type: 'logs' });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (userFilter !== 'all') params.set('userId', userFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleReset = () => {
    setActionFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatMetadata = (metadata: Record<string, unknown>) => {
    const entries = Object.entries(metadata).filter(([_, v]) => v != null);
    if (entries.length === 0) return '-';
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">操作種別</label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="login">ログイン</SelectItem>
              <SelectItem value="api_key_change">APIキー変更</SelectItem>
              <SelectItem value="mode_change">モード変更</SelectItem>
              <SelectItem value="thread_create">スレッド作成</SelectItem>
              <SelectItem value="thread_delete">スレッド削除</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">ユーザー</label>
          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
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

        <div className="space-y-1">
          <label className="text-xs text-gray-500">開始日</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-8 w-[140px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">終了日</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-8 w-[140px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          リセット
        </Button>

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-8 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
          >
            <Download className="w-3 h-3 mr-1" />
            CSV出力
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500">
        {total}件の操作ログ
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">日時</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">ユーザー</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">操作</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">詳細</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                  操作ログがありません
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: 'outline' as const };
                return (
                  <tr key={log.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2.5 px-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-300 font-mono">
                      {log.user.email}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={actionInfo.variant} className="text-xs">
                        {actionInfo.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400 max-w-[200px] truncate">
                      {formatMetadata(log.metadata)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

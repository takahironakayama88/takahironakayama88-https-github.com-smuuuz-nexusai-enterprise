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
import { Pagination } from './Pagination';
import { ChatDetailDialog } from './ChatDetailDialog';
import { Loader2, Download, Search, RotateCcw, MessageSquare, ChevronRight } from 'lucide-react';

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  user: { email: string };
  _count: { messages: number };
}

interface AuditUser {
  id: string;
  email: string;
  role: string;
}

interface ChatAuditPanelProps {
  token: string;
}

export function ChatAuditPanel({ token }: ChatAuditPanelProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detail dialog
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [token]);

  useEffect(() => {
    loadThreads();
  }, [page, searchKeyword, userFilter, dateFrom, dateTo]);

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

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (searchKeyword) params.set('keyword', searchKeyword);
      if (userFilter !== 'all') params.set('userId', userFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/audit/chats?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to load chat threads:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchKeyword, userFilter, dateFrom, dateTo, token]);

  const handleSearch = () => {
    setSearchKeyword(keyword);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ type: 'chats' });
      if (searchKeyword) params.set('keyword', searchKeyword);
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
        a.download = `chat-audit-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleReset = () => {
    setKeyword('');
    setSearchKeyword('');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleOpenDetail = (threadId: string) => {
    setSelectedThreadId(threadId);
    setIsDetailOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">キーワード検索</label>
          <div className="flex gap-1">
            <Input
              type="text"
              placeholder="メッセージ内容を検索..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-[200px] text-xs bg-gray-800/60 border-gray-600/50 text-gray-100 placeholder:text-gray-500"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSearch}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
            >
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
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
        {total}件のスレッド
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            スレッドがありません
          </div>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleOpenDetail(thread.id)}
              className="w-full text-left backdrop-blur-sm bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/30 hover:border-gray-600/50 rounded-xl p-4 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-200 font-medium truncate">
                      {thread.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="font-mono">{thread.user.email}</span>
                    <span>{thread._count.messages}件のメッセージ</span>
                    <span>{formatDate(thread.updatedAt)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0 ml-2" />
              </div>
            </button>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <ChatDetailDialog
        threadId={selectedThreadId}
        token={token}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}

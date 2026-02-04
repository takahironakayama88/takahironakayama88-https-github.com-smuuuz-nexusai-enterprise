'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, Bot } from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ThreadDetail {
  id: string;
  title: string;
  createdAt: string;
  user: { email: string };
  messages: Message[];
}

interface ChatDetailDialogProps {
  threadId: string | null;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDetailDialog({ threadId, token, open, onOpenChange }: ChatDetailDialogProps) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && threadId) {
      loadThread();
    } else {
      setThread(null);
    }
  }, [open, threadId]);

  const loadThread = async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/audit/chats/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setThread(data.thread);
      }
    } catch (error) {
      console.error('Failed to load thread detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 bg-transparent border-none shadow-none">
        <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-800/50">
            <DialogTitle className="text-base font-semibold text-gray-100">
              {thread ? thread.title : 'チャット詳細'}
            </DialogTitle>
            {thread && (
              <p className="text-xs text-gray-500 mt-1">
                {thread.user.email} - {new Date(thread.createdAt).toLocaleString('ja-JP')}
              </p>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : thread ? (
              <div className="space-y-4 pb-2">
                {thread.messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? '' : ''}`}>
                    <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      msg.role === 'user'
                        ? 'bg-indigo-500/20 border border-indigo-500/30'
                        : 'bg-gray-700/50 border border-gray-600/30'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400">
                          {msg.role === 'user' ? 'ユーザー' : 'AI'}
                        </span>
                        <span className="text-xs text-gray-600">{formatTime(msg.createdAt)}</span>
                      </div>
                      <div className="text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-12">
                データがありません
              </p>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

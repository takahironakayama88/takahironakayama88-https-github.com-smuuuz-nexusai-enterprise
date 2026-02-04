'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Send, User, Bot, Menu, LogOut, Copy, Check, Loader2, Pencil, Trash2, Save, X, LayoutDashboard, Paperclip, Sparkles, ChevronDown } from 'lucide-react';

interface Thread {
  id: string;
  title: string;
  createdAt: string;
}

interface User {
  email: string;
  organizationName: string;
  role: string;
}

interface Mode {
  id: string;
  name: string;
  description: string;
  icon: string;
  modelId: string | null;
  modeName: string | null;
}

interface AssistantData {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  iconColor: string;
  systemPrompt: string;
  modelId: string | null;
  conversationStarters: string;
  visibility: string;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string; displayOrder: number } | null;
}

const ASSISTANT_COLORS: Record<string, string> = {
  indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30',
  purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
  red: 'from-red-500/20 to-red-600/10 border-red-500/30',
};

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [modes, setModes] = useState<Mode[]>([]);
  const [selectedMode, setSelectedMode] = useState(() => {
    // 最後に使用したモードを記憶
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastUsedMode') || 'balanced';
    }
    return 'balanced';
  });
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [placeholder, setPlaceholder] = useState('メッセージを入力...');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<Thread | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [assistants, setAssistants] = useState<AssistantData[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [assistantPickerOpen, setAssistantPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const attachmentsRef = useRef<Array<{ name: string; type: string; isImage: boolean; base64Data: string }>>([]);

  // メッセージごとのモデルIDを記録
  const [messageModels, setMessageModels] = useState<Record<string, string>>({});

  // useRefで常に最新のtokenを参照できるようにする
  const tokenRef = useRef<string>('');
  const selectedModeRef = useRef<string>(selectedMode);
  const currentThreadIdRef = useRef<string | null>(currentThreadId);
  const selectedAssistantIdRef = useRef<string | null>(selectedAssistantId);

  // refを最新の値で更新
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    selectedModeRef.current = selectedMode;
    // 最後に使用したモードを保存
    localStorage.setItem('lastUsedMode', selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
  }, [currentThreadId]);

  useEffect(() => {
    selectedAssistantIdRef.current = selectedAssistantId;
  }, [selectedAssistantId]);

  // AI SDK v6: DefaultChatTransportを使用（SSE自動パース）
  // bodyを関数にすることで、リクエストごとに最新の値を取得
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: () => ({
          Authorization: `Bearer ${tokenRef.current}`,
        }),
        body: () => ({
          modeId: selectedModeRef.current,  // refから最新のモードIDを取得
          threadId: currentThreadIdRef.current,
          assistantId: selectedAssistantIdRef.current || undefined,
          attachments: attachmentsRef.current.length > 0 ? attachmentsRef.current : undefined,
        }),
      }),
    [] // transportは一度だけ作成、bodyは関数なので毎回最新の値を使用
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onFinish: (message) => {
      console.log('✅ Message received:', message);
      // 受信したメッセージのモードIDを記録（refから最新の値を取得）
      if (message.message.id) {
        setMessageModels(prev => ({
          ...prev,
          [message.message.id]: selectedModeRef.current,
        }));
      }
    },
    onError: (error) => {
      console.error('❌ Chat error:', error);
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // デバッグ: メッセージ変更を監視
  useEffect(() => {
    console.log('📝 Messages updated:', messages.length, messages);
  }, [messages]);

  // プレースホルダーを動的に変更
  useEffect(() => {
    const placeholders = [
      'メッセージを入力...',
      'この文章を要約して...',
      '〇〇について教えて...',
      'このコードをレビューして...',
      '英語に翻訳して...',
      'アイデアを出して...',
    ];

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % placeholders.length;
      setPlaceholder(placeholders[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('コピーに失敗しました:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
    // 同じファイルを再選択できるようにリセット
    e.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      const validFiles = Array.from(files).filter(f => allowedTypes.includes(f.type));
      if (validFiles.length > 0) {
        setAttachedFiles(prev => [...prev, ...validFiles]);
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isUploading) return;

    // 添付ファイルがある場合はアップロード
    if (attachedFiles.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        attachedFiles.forEach(file => formData.append('files', file));

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          console.error('Upload failed:', error);
          alert(error.error || 'ファイルアップロードに失敗しました');
          setIsUploading(false);
          return;
        }

        const uploadData = await uploadResponse.json();
        attachmentsRef.current = uploadData.files;
        console.log('📎 Files uploaded:', uploadData.files.length);
      } catch (error) {
        console.error('Upload error:', error);
        alert('ファイルアップロード中にエラーが発生しました');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    } else {
      attachmentsRef.current = [];
    }

    // スレッドがない場合は先に作成
    if (!currentThreadIdRef.current) {
      try {
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({
            title: input.substring(0, 30) || 'New Chat',
            assistantId: selectedAssistantIdRef.current || undefined,
          }),
        });
        const data = await response.json();
        setCurrentThreadId(data.thread.id);
        currentThreadIdRef.current = data.thread.id; // refも即座に更新
        await loadThreads(tokenRef.current);
      } catch (error) {
        console.error('Failed to create thread:', error);
        return;
      }
    }

    console.log('📤 Sending message:', input);
    console.log('🔑 Token:', tokenRef.current ? 'Present' : 'Missing');
    console.log('🤖 Mode:', selectedMode);
    console.log('💬 Thread:', currentThreadIdRef.current);
    console.log('📎 Attachments:', attachmentsRef.current.length);

    const userMessage = {
      role: 'user' as const,
      content: input,
      parts: [{ type: 'text' as const, text: input }],
    };

    sendMessage(userMessage);

    // 次のティックでメッセージIDを取得して記録（少し遅延させる）
    setTimeout(() => {
      const lastMessage = messages[messages.length];
      if (lastMessage?.id) {
        setMessageModels(prev => ({
          ...prev,
          [lastMessage.id]: selectedModeRef.current,
        }));
      }
    }, 100);

    setInput('');
    setAttachedFiles([]);
    attachmentsRef.current = [];
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      router.push('/login');
      return;
    }

    setToken(storedToken);
    setUser(JSON.parse(storedUser));
    loadThreads(storedToken);
    loadModes(storedToken);
    loadAssistants(storedToken);
  }, [router]);

  const loadThreads = async (authToken: string) => {
    try {
      const response = await fetch('/api/threads', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const loadModes = async (authToken: string) => {
    try {
      const response = await fetch('/api/settings/modes', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      if (data.modes && data.modes.length > 0) {
        setModes(data.modes);
        // 現在選択中のモードが利用不可なら、最初のモードに切り替え
        const savedMode = localStorage.getItem('lastUsedMode');
        const isAvailable = data.modes.some((m: Mode) => m.id === savedMode);
        if (!isAvailable) {
          setSelectedMode(data.modes[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load modes:', error);
    }
  };

  const loadAssistants = async (authToken: string) => {
    try {
      const response = await fetch('/api/assistants', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAssistants(data.assistants || []);
      }
    } catch (error) {
      console.error('Failed to load assistants:', error);
    }
  };

  const selectAssistant = (assistantId: string | null) => {
    setSelectedAssistantId(assistantId);
    setAssistantPickerOpen(false);
    // 新しいチャットを開始
    if (assistantId !== selectedAssistantId) {
      setCurrentThreadId(null);
      setMessages([]);
      setMessageModels({});
    }
  };

  const selectedAssistant = assistants.find(a => a.id === selectedAssistantId) || null;

  const createNewThread = () => {
    // 現在のチャットをリセット（次の送信時に自動でスレッドが作成される）
    setCurrentThreadId(null);
    setMessages([]);
    setMessageModels({});
  };

  const selectThread = async (threadId: string) => {
    if (threadId === currentThreadId) return;

    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to load thread');
        return;
      }

      const data = await response.json();
      setCurrentThreadId(threadId);

      // メッセージをAI SDK形式に変換してロード
      const loadedMessages = data.thread.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        parts: msg.role === 'assistant' ? [{ type: 'text', text: msg.content }] : undefined,
      }));

      setMessages(loadedMessages);

      // モデル情報もロード
      const models: Record<string, string> = {};
      data.thread.messages.forEach((msg: any) => {
        if (msg.modelId) {
          models[msg.id] = msg.modelId;
        }
      });
      setMessageModels(models);
    } catch (error) {
      console.error('Failed to select thread:', error);
    }
  };

  const startEditThread = (threadId: string, currentTitle: string) => {
    setEditingThreadId(threadId);
    setEditingThreadTitle(currentTitle);
  };

  const cancelEditThread = () => {
    setEditingThreadId(null);
    setEditingThreadTitle('');
  };

  const saveThreadTitle = async (threadId: string) => {
    if (!editingThreadTitle.trim()) return;

    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editingThreadTitle }),
      });

      if (response.ok) {
        await loadThreads(token);
        cancelEditThread();
      }
    } catch (error) {
      console.error('Failed to update thread:', error);
    }
  };

  const openDeleteDialog = (thread: Thread) => {
    setThreadToDelete(thread);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteThread = async () => {
    if (!threadToDelete) return;

    try {
      const response = await fetch(`/api/threads/${threadToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        if (currentThreadId === threadToDelete.id) {
          setCurrentThreadId(null);
          setMessages([]);
        }
        await loadThreads(token);
      }
    } catch (error) {
      console.error('Failed to delete thread:', error);
    } finally {
      setDeleteDialogOpen(false);
      setThreadToDelete(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-950 to-gray-900">
      {/* サイドバー */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 backdrop-blur-xl bg-gradient-to-b from-gray-900/95 to-black/95 border-r border-gray-700/30 shadow-2xl flex flex-col overflow-hidden`}
      >
        {sidebarOpen && (
          <>
            {/* ヘッダー */}
            <div className="p-4 border-b border-gray-700/30 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-200">チャット履歴</h2>
                <span
                  className="p-1 cursor-pointer text-gray-400 hover:text-gray-100 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="w-4 h-4" />
                </span>
              </div>
              <Button
                onClick={createNewThread}
                className="w-full h-9 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                新しいチャット
              </Button>
            </div>

            {/* スレッドリスト */}
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-1">
                {threads.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">
                    チャット履歴がありません
                  </p>
                ) : (
                  threads.map((thread) => (
                    <div key={thread.id} className="relative group">
                      {editingThreadId === thread.id ? (
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <input
                            type="text"
                            value={editingThreadTitle}
                            onChange={(e) => setEditingThreadTitle(e.target.value)}
                            className="flex-1 min-w-0 h-7 px-2 text-sm bg-gray-900/80 text-gray-100 border border-gray-600/50 rounded-md focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveThreadTitle(thread.id);
                              } else if (e.key === 'Escape') {
                                cancelEditThread();
                              }
                            }}
                          />
                          <span
                            className="shrink-0 p-1 cursor-pointer text-gray-100 hover:opacity-70 transition-opacity"
                            onClick={() => saveThreadTitle(thread.id)}
                            title="保存 (Enter)"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`grid grid-cols-[1fr_auto] items-center px-2 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                            currentThreadId === thread.id
                              ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                              : 'hover:bg-gray-800/50 border border-transparent'
                          }`}
                          onClick={() => selectThread(thread.id)}
                        >
                          <span className={`text-sm truncate ${
                            currentThreadId === thread.id ? 'text-gray-100 font-medium' : 'text-gray-300'
                          }`}>
                            {thread.title}
                          </span>
                          {/* アクションボタン */}
                          <div className="flex items-center gap-1 ml-1">
                            <span
                              className="p-1 cursor-pointer text-gray-400 hover:text-gray-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditThread(thread.id, thread.title);
                              }}
                              title="名前を変更"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </span>
                            <span
                              className="p-1 cursor-pointer text-gray-400 hover:text-red-400 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(thread);
                              }}
                              title="削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* フッター */}
            <div className="p-4 border-t border-gray-700/30 bg-gray-900/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{user?.email}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.organizationName}</p>
                </div>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="w-full h-9 text-sm !text-gray-100 hover:bg-gray-700/50 rounded-lg transition-all duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                ログアウト
              </Button>
            </div>
          </>
        )}
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* ヘッダー */}
        <div className="px-4 py-4 mb-3 backdrop-blur-xl bg-black/60 border-b border-gray-700/30 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 transition-all duration-200 bg-gray-700/40 !hover:bg-gray-700/20 text-gray-100"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <Button
                  onClick={createNewThread}
                  variant="ghost"
                  size="sm"
                  className="h-10 px-3 text-sm text-gray-100 transition-all duration-200 bg-gray-700/40 !hover:bg-gray-700/20"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  新しいチャット
                </Button>
              </>
            )}

            {modes.length > 0 ? (
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger className="w-[180px] h-10 text-sm backdrop-blur-md bg-gray-800/60 border-gray-600/50 hover:bg-gray-700/70 text-gray-100 transition-all duration-200 rounded-xl">
                  <span>{modes.find(m => m.id === selectedMode)?.name || 'モード選択'}</span>
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-gray-900/95 border-gray-700/50 rounded-xl shadow-2xl overflow-hidden p-1.5 min-w-[260px]">
                  {modes.map((mode) => {
                    const modeInfo: Record<string, { color: string; description: string }> = {
                      fast: {
                        color: 'hover:bg-gradient-to-r hover:from-yellow-500/20 hover:to-orange-500/20 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-yellow-500/30 data-[state=checked]:to-orange-500/30',
                        description: '素早い回答が必要なとき',
                      },
                      balanced: {
                        color: 'hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-cyan-500/20 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500/30 data-[state=checked]:to-cyan-500/30',
                        description: '日常的な質問や相談に',
                      },
                      precision: {
                        color: 'hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500/30 data-[state=checked]:to-pink-500/30',
                        description: '複雑な分析や専門的な内容に',
                      },
                    };
                    const info = modeInfo[mode.id] || { color: '', description: '' };
                    return (
                      <SelectItem
                        key={mode.id}
                        value={mode.id}
                        textValue={mode.name}
                        className={`text-gray-100 cursor-pointer transition-all duration-200 rounded-lg my-1 py-3 ${info.color}`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{mode.name}</span>
                          <span className="text-xs text-gray-400">{info.description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 px-4 flex items-center text-sm text-gray-400 bg-gray-800/60 border border-gray-600/50 rounded-xl">
                モード未設定
              </div>
            )}

            {/* Assistant selector */}
            {assistants.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setAssistantPickerOpen(!assistantPickerOpen)}
                  className={`h-10 px-3 text-sm rounded-xl flex items-center gap-2 transition-all duration-200 border ${
                    selectedAssistant
                      ? `bg-gradient-to-r ${ASSISTANT_COLORS[selectedAssistant.iconColor] || ASSISTANT_COLORS.indigo}`
                      : 'bg-gray-800/60 border-gray-600/50 hover:bg-gray-700/70 text-gray-300'
                  }`}
                >
                  {selectedAssistant ? (
                    <>
                      <span className="text-base">{selectedAssistant.iconEmoji}</span>
                      <span className="max-w-[120px] truncate text-gray-100">{selectedAssistant.name}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>アシスタント</span>
                    </>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {/* Dropdown */}
                {assistantPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAssistantPickerOpen(false)} />
                    <div className="absolute top-full mt-2 right-0 z-50 w-72 backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-xl shadow-2xl p-2 max-h-[400px] overflow-y-auto">
                      {/* None option */}
                      <button
                        onClick={() => selectAssistant(null)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                          !selectedAssistantId ? 'bg-indigo-500/15 border border-indigo-500/30' : 'hover:bg-gray-800/50 border border-transparent'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-gray-800/60 border border-gray-700/30 flex items-center justify-center text-sm">
                          💬
                        </div>
                        <div>
                          <p className="text-sm text-gray-100 font-medium">通常チャット</p>
                          <p className="text-xs text-gray-500">アシスタントなし</p>
                        </div>
                      </button>

                      {assistants.length > 0 && (
                        <div className="h-px bg-gray-800/50 my-1.5" />
                      )}

                      {/* Group assistants by category */}
                      {(() => {
                        // Build category groups
                        const categoryMap = new Map<string, { name: string; displayOrder: number; assistants: AssistantData[] }>();
                        const uncategorized: AssistantData[] = [];

                        assistants.forEach((a) => {
                          if (a.category) {
                            const existing = categoryMap.get(a.category.id);
                            if (existing) {
                              existing.assistants.push(a);
                            } else {
                              categoryMap.set(a.category.id, {
                                name: a.category.name,
                                displayOrder: a.category.displayOrder,
                                assistants: [a],
                              });
                            }
                          } else {
                            uncategorized.push(a);
                          }
                        });

                        const sortedGroups = Array.from(categoryMap.values()).sort((a, b) => a.displayOrder - b.displayOrder);

                        const renderAssistantButton = (assistant: AssistantData) => (
                          <button
                            key={assistant.id}
                            onClick={() => selectAssistant(assistant.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                              selectedAssistantId === assistant.id
                                ? `bg-gradient-to-r ${ASSISTANT_COLORS[assistant.iconColor] || ASSISTANT_COLORS.indigo}`
                                : 'hover:bg-gray-800/50 border border-transparent'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ASSISTANT_COLORS[assistant.iconColor] || ASSISTANT_COLORS.indigo} flex items-center justify-center text-sm`}>
                              {assistant.iconEmoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-100 font-medium truncate">{assistant.name}</p>
                              <p className="text-xs text-gray-500 truncate">{assistant.description || 'カスタムアシスタント'}</p>
                            </div>
                          </button>
                        );

                        return (
                          <>
                            {sortedGroups.map((group) => (
                              <div key={group.name}>
                                <div className="px-3 pt-2.5 pb-1">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{group.name}</span>
                                </div>
                                {group.assistants.map(renderAssistantButton)}
                              </div>
                            ))}
                            {uncategorized.length > 0 && sortedGroups.length > 0 && (
                              <div>
                                <div className="px-3 pt-2.5 pb-1">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">未分類</span>
                                </div>
                                {uncategorized.map(renderAssistantButton)}
                              </div>
                            )}
                            {uncategorized.length > 0 && sortedGroups.length === 0 && (
                              <>{uncategorized.map(renderAssistantButton)}</>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {user?.role === 'OWNER' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="h-10 px-3 text-sm text-gray-100 transition-all duration-200 bg-gray-700/40 !hover:bg-gray-700/20"
            >
              <LayoutDashboard className="w-4 h-4 mr-1.5" />
              ダッシュボード
            </Button>
          )}
        </div>

        {/* チャットエリア */}
        <div className="flex-1 px-4">
          <div className="max-w-[800px] mx-auto space-y-6 min-h-full flex flex-col">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center pt-[20vh]">
                {selectedAssistant ? (
                  <>
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${ASSISTANT_COLORS[selectedAssistant.iconColor] || ASSISTANT_COLORS.indigo} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
                      {selectedAssistant.iconEmoji}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-1">{selectedAssistant.name}</h3>
                    {selectedAssistant.description && (
                      <p className="text-sm text-gray-400 mb-6 max-w-md text-center">{selectedAssistant.description}</p>
                    )}
                    {(() => {
                      const starters = JSON.parse(selectedAssistant.conversationStarters || '[]') as string[];
                      if (starters.length === 0 || !starters[0]) return null;
                      return (
                        <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                          {starters.map((starter, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setInput(starter);
                              }}
                              className={`px-4 py-2.5 text-sm rounded-xl border bg-gradient-to-r ${ASSISTANT_COLORS[selectedAssistant.iconColor] || ASSISTANT_COLORS.indigo} text-gray-100 hover:scale-[1.03] transition-all duration-200 shadow-md`}
                            >
                              {starter}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-[1.35rem] text-gray-400 pt-[18vh]">何を考えていますか？</p>
                )}
              </div>
            )}

            {messages.length > 0 && <div className="pt-6" />}
            {messages.map((message) => {
              // AI SDK v6: partsからテキストを取得
              const messageText = message.parts
                ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                .map((part) => part.text)
                .join('') || '';

              // このメッセージのモードIDを取得
              const messageModeId = messageModels[message.id];
              const modeInfo = modes.find(m => m.id === messageModeId);
              const modeName = modeInfo ? modeInfo.name : '';

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarFallback className="bg-muted">
                        <Bot className="w-3.5 h-3.5" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`rounded-2xl px-5 py-3.5 max-w-[85%] relative group backdrop-blur-lg border shadow-lg transition-all duration-200 hover:shadow-xl ${
                      message.role === 'user'
                        ? 'bg-indigo-600/90 text-white border-indigo-500/30'
                        : 'bg-gray-800/80 text-gray-100 border-gray-700/50'
                    }`}
                  >
                    {modeName && (
                      <div className="text-xs opacity-60 mb-1.5 font-medium">
                        {modeName}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{messageText}</p>

                    {/* コピーボタン */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                      onClick={() => handleCopy(messageText, message.id)}
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10">
                        <User className="w-3.5 h-3.5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}

            {/* タイピングインジケーター */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="bg-muted">
                    <Bot className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl px-5 py-3.5 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground/80">
                      思考中...
                    </span>
                  </div>
                </div>
              </div>
            )}
            {messages.length > 0 && <div className="pb-12" />}
          </div>
        </div>

        {/* 入力エリア */}
        <div
          className="px-4 pb-6 flex justify-center"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <form onSubmit={handleSubmit}>
            <div className="relative w-[680px]">
              {/* ドラッグ＆ドロップオーバーレイ */}
              {isDragging && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] border-2 border-dashed border-indigo-400/70 bg-indigo-500/10 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Paperclip className="w-8 h-8 text-indigo-400" />
                    <span className="text-sm text-indigo-300 font-medium">ファイルをドロップして添付</span>
                  </div>
                </div>
              )}
              {/* 添付ファイルプレビュー */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-600/50 rounded-lg text-sm text-gray-300"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(index)}
                        className="bg-transparent border-none p-0 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 非表示のファイル入力 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
              />

              {/* クリップボタン */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading || modes.length === 0}
                className="absolute left-[-56px] bottom-[19px] h-10 w-10 flex items-center justify-center bg-transparent border-none text-white hover:opacity-70 disabled:opacity-30 transition-opacity duration-200 cursor-pointer"
              >
                <Paperclip className="w-6 h-6" />
              </button>

              <Textarea
                value={input}
                onChange={handleInputChange}
                placeholder={modes.length === 0 ? 'ダッシュボードでモードを設定してください' : placeholder}
                className="min-h-14 max-h-[40svh] pl-6 pr-16 py-4 text-[1.2rem] resize-none backdrop-blur-lg bg-gray-900/80 text-gray-100 placeholder:text-gray-500 border-gray-600/50 focus:border-indigo-500/60 rounded-[28px] shadow-lg transition-all duration-200 focus:shadow-xl [field-sizing:content] overflow-y-auto"
                disabled={isLoading || isUploading || modes.length === 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                type="submit"
                disabled={isLoading || isUploading || !input.trim() || modes.length === 0}
                size="icon"
                className="absolute right-[-72px] bottom-[19px] h-12 w-12 rounded-full backdrop-blur-lg bg-indigo-600/90 hover:bg-indigo-500/90 border border-indigo-500/30 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          </form>
        </div>

        {/* 下部スペーサー */}
        <div className="h-[130px]"></div>
      </div>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[320px] p-0 bg-transparent border-none shadow-none">
          <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl p-5 shadow-2xl">
            {/* アイコン */}
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-gray-800/80 border border-gray-600/50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* タイトル */}
            <DialogHeader className="text-center space-y-1.5">
              <DialogTitle className="text-base font-semibold text-gray-100">
                チャットを削除しますか？
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                「<span className="text-gray-200 font-medium">{threadToDelete?.title}</span>」を削除します。
                <br />
                この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>

            {/* ボタン */}
            <div className="flex gap-2 mt-5">
              <Button
                variant="ghost"
                onClick={() => setDeleteDialogOpen(false)}
                className="flex-1 h-10 text-sm text-gray-300 hover:text-gray-100 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl transition-all duration-200"
              >
                キャンセル
              </Button>
              <Button
                onClick={confirmDeleteThread}
                className="flex-1 h-10 text-sm bg-red-500 hover:bg-red-600 text-black hover:text-white rounded-xl transition-all duration-200"
              >
                削除する
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

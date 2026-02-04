'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Sparkles, MessageSquare, Copy, Check, FolderOpen, Tag } from 'lucide-react';

interface AssistantCategory {
  id: string;
  name: string;
  displayOrder: number;
  _count: { assistants: number };
}

interface Assistant {
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
  createdBy: string;
  createdAt: string;
  creator: { email: string };
  categoryId: string | null;
  category: { id: string; name: string; displayOrder: number } | null;
}

interface AssistantManagementSectionProps {
  token: string;
}

const ICON_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  indigo:  { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
  purple:  { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
  blue:    { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  green:   { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  orange:  { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
  pink:    { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400' },
  red:     { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
};

const EMOJI_OPTIONS = ['🤖', '💼', '📊', '🔍', '📝', '💡', '🎯', '🛡️', '📚', '⚡', '🧠', '🔧', '📋', '🌐', '💬', '🏢'];

const DEFAULT_FORM = {
  name: '',
  description: '',
  iconEmoji: '🤖',
  iconColor: 'indigo',
  systemPrompt: '',
  modelId: '',
  conversationStarters: [''],
  visibility: 'all',
  categoryId: '',
};

export function AssistantManagementSection({ token }: AssistantManagementSectionProps) {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [categories, setCategories] = useState<AssistantCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assistantToDelete, setAssistantToDelete] = useState<Assistant | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Category management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    loadAssistants();
    loadCategories();
  }, [token]);

  const loadAssistants = async () => {
    try {
      const res = await fetch('/api/assistants', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssistants(data.assistants);
      }
    } catch (err) {
      console.error('Failed to load assistants:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/assistant-categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError('');
    setDialogOpen(true);
  };

  const openEditDialog = (assistant: Assistant) => {
    setEditingId(assistant.id);
    const starters = JSON.parse(assistant.conversationStarters || '[]') as string[];
    setForm({
      name: assistant.name,
      description: assistant.description,
      iconEmoji: assistant.iconEmoji,
      iconColor: assistant.iconColor,
      systemPrompt: assistant.systemPrompt,
      modelId: assistant.modelId || '',
      conversationStarters: starters.length > 0 ? starters : [''],
      visibility: assistant.visibility,
      categoryId: assistant.categoryId || '',
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('アシスタント名を入力してください');
      return;
    }
    if (!form.systemPrompt.trim()) {
      setError('システムプロンプトを入力してください');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      ...form,
      modelId: form.modelId || null,
      conversationStarters: form.conversationStarters.filter(s => s.trim()),
      categoryId: form.categoryId || null,
    };

    try {
      const url = editingId ? `/api/assistants/${editingId}` : '/api/assistants';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setDialogOpen(false);
        await loadAssistants();
      } else {
        const data = await res.json();
        setError(data.error || '保存に失敗しました');
      }
    } catch {
      setError('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!assistantToDelete) return;

    try {
      const res = await fetch(`/api/assistants/${assistantToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDeleteDialogOpen(false);
        setAssistantToDelete(null);
        await loadAssistants();
      }
    } catch (err) {
      console.error('Delete assistant error:', err);
    }
  };

  const toggleActive = async (assistant: Assistant) => {
    try {
      await fetch(`/api/assistants/${assistant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !assistant.isActive }),
      });
      await loadAssistants();
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const handleCopyPrompt = async (prompt: string, id: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const addStarter = () => {
    setForm(prev => ({ ...prev, conversationStarters: [...prev.conversationStarters, ''] }));
  };

  const removeStarter = (index: number) => {
    setForm(prev => ({
      ...prev,
      conversationStarters: prev.conversationStarters.filter((_, i) => i !== index),
    }));
  };

  const updateStarter = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      conversationStarters: prev.conversationStarters.map((s, i) => i === index ? value : s),
    }));
  };

  // Category CRUD handlers
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCategorySaving(true);
    setCategoryError('');

    try {
      const res = await fetch('/api/assistant-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      if (res.ok) {
        setNewCategoryName('');
        await loadCategories();
      } else {
        const data = await res.json();
        setCategoryError(data.error || 'カテゴリの作成に失敗しました');
      }
    } catch {
      setCategoryError('カテゴリの作成に失敗しました');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    setCategorySaving(true);
    setCategoryError('');

    try {
      const res = await fetch(`/api/assistant-categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editingCategoryName.trim() }),
      });

      if (res.ok) {
        setEditingCategoryId(null);
        setEditingCategoryName('');
        await Promise.all([loadCategories(), loadAssistants()]);
      } else {
        const data = await res.json();
        setCategoryError(data.error || 'カテゴリの更新に失敗しました');
      }
    } catch {
      setCategoryError('カテゴリの更新に失敗しました');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('このカテゴリを削除しますか？\n所属するアシスタントは「未分類」に移動します。')) return;
    setCategorySaving(true);
    setCategoryError('');

    try {
      const res = await fetch(`/api/assistant-categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await Promise.all([loadCategories(), loadAssistants()]);
      } else {
        const data = await res.json();
        setCategoryError(data.error || 'カテゴリの削除に失敗しました');
      }
    } catch {
      setCategoryError('カテゴリの削除に失敗しました');
    } finally {
      setCategorySaving(false);
    }
  };

  const colorStyle = (color: string) => ICON_COLORS[color] || ICON_COLORS.indigo;

  // Group assistants by category
  const groupedAssistants = (() => {
    const groups: { category: AssistantCategory | null; assistants: Assistant[] }[] = [];

    // Sorted categories by displayOrder
    const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

    for (const cat of sortedCategories) {
      const catAssistants = assistants.filter(a => a.categoryId === cat.id);
      if (catAssistants.length > 0) {
        groups.push({ category: cat, assistants: catAssistants });
      }
    }

    // Uncategorized
    const uncategorized = assistants.filter(a => !a.categoryId);
    if (uncategorized.length > 0) {
      groups.push({ category: null, assistants: uncategorized });
    }

    return groups;
  })();

  const renderAssistantCard = (assistant: Assistant) => {
    const cs = colorStyle(assistant.iconColor);
    const starters = JSON.parse(assistant.conversationStarters || '[]') as string[];

    return (
      <div
        key={assistant.id}
        style={{ maxHeight: '147px' }}
        className={`group relative backdrop-blur-xl bg-gray-900/60 border rounded-xl px-4 py-3 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] overflow-hidden ${
          assistant.isActive
            ? `border-gray-700/50 hover:${cs.border}`
            : 'border-gray-800/30 opacity-60'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className={`w-8 h-8 rounded-lg ${cs.bg} border ${cs.border} flex items-center justify-center text-sm shrink-0`}>
            {assistant.iconEmoji}
          </div>
          <div className="flex-1 min-w-0 pr-16">
            <h4 className="text-white font-semibold text-[13px] leading-tight truncate">{assistant.name}</h4>
            <p className="text-[11px] text-gray-500 truncate leading-none mt-0.5">{assistant.description || 'カスタムアシスタント'}</p>
          </div>
        </div>

        {/* System prompt preview (1 line) */}
        <div className="mb-1.5 relative group/prompt">
          <div className="text-[11px] text-gray-400 bg-gray-800/40 rounded-md px-2 py-1 truncate border border-gray-700/20 leading-snug">
            {assistant.systemPrompt}
          </div>
          <button
            onClick={() => handleCopyPrompt(assistant.systemPrompt, assistant.id)}
            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-gray-700/60 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
          >
            {copiedPrompt === assistant.id
              ? <Check className="w-2.5 h-2.5 text-green-400" />
              : <Copy className="w-2.5 h-2.5 text-gray-400" />
            }
          </button>
        </div>

        {/* Conversation starters (inline) */}
        {starters.length > 0 && starters[0] && (
          <div className="flex gap-1 mb-1.5 overflow-hidden" style={{ maxHeight: '18px' }}>
            {starters.slice(0, 2).map((starter, i) => (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-px rounded-full ${cs.bg} ${cs.text} border ${cs.border} truncate max-w-[120px] shrink-0`}
              >
                {starter}
              </span>
            ))}
            {starters.length > 2 && (
              <span className="text-[10px] text-gray-500 shrink-0">+{starters.length - 2}</span>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center justify-between text-[10px] text-gray-600 pt-1.5 border-t border-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              {assistant.visibility === 'all'
                ? <><Eye className="w-2.5 h-2.5" /> 全員</>
                : <><EyeOff className="w-2.5 h-2.5" /> 管理者のみ</>
              }
            </span>
            {assistant.modelId && (
              <span className="text-gray-500 truncate max-w-[80px]">{assistant.modelId}</span>
            )}
          </div>
          <span>{new Date(assistant.createdAt).toLocaleDateString('ja-JP')}</span>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2.5 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => toggleActive(assistant)}
            className={`p-1 rounded-md transition-colors ${
              assistant.isActive
                ? 'hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400'
                : 'hover:bg-green-500/10 text-gray-500 hover:text-green-400'
            }`}
            title={assistant.isActive ? '無効にする' : '有効にする'}
          >
            {assistant.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={() => openEditDialog(assistant)}
            className="p-1 rounded-md hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-colors"
            title="編集"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => { setAssistantToDelete(assistant); setDeleteDialogOpen(true); }}
            className="p-1 rounded-md hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
            title="削除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">カスタムアシスタント</h3>
          <p className="text-sm text-gray-500 mt-0.5">社内向けAIアシスタントを作成・管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setCategoryError(''); setCategoryDialogOpen(true); }}
            variant="ghost"
            className="h-10 px-4 text-sm text-gray-300 hover:text-white bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl transition-all duration-200"
          >
            <Tag className="w-4 h-4 mr-2" />
            カテゴリ管理
          </Button>
          <Button
            onClick={openCreateDialog}
            className="h-10 px-4 text-sm bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black rounded-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            新規作成
          </Button>
        </div>
      </div>

      {/* Assistant cards grouped by category */}
      {assistants.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm mb-1">アシスタントがまだありません</p>
          <p className="text-gray-600 text-xs">「新規作成」で社内向けAIアシスタントを追加しましょう</p>
        </div>
      ) : groupedAssistants.length > 0 ? (
        <div className="space-y-6">
          {groupedAssistants.map((group, groupIndex) => (
            <div key={group.category?.id || 'uncategorized'}>
              {/* Category section header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  {group.category ? (
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <FolderOpen className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span className={`text-sm font-medium ${group.category ? 'text-gray-200' : 'text-gray-500'}`}>
                    {group.category?.name || '未分類'}
                  </span>
                </div>
                <span className="text-[11px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
                  {group.assistants.length}
                </span>
                {groupIndex < groupedAssistants.length - 1 && (
                  <div className="flex-1 h-px bg-gray-800/50 ml-2" />
                )}
              </div>

              {/* Cards grid */}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, 330px)' }}>
                {group.assistants.map(renderAssistantCard)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Category management dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md p-0 bg-transparent border-none shadow-none">
          <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 z-10 backdrop-blur-xl bg-gray-900/95 px-6 pt-6 pb-4 border-b border-gray-800/50 rounded-t-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-indigo-400" />
                  カテゴリ管理
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  アシスタントを分類するカテゴリを管理します
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* New category input */}
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="新しいカテゴリ名（例: 人事部）"
                  className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 placeholder:text-gray-500 rounded-lg flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory();
                  }}
                />
                <Button
                  onClick={handleCreateCategory}
                  disabled={categorySaving || !newCategoryName.trim()}
                  className="h-9 px-3 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  {categorySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {categoryError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{categoryError}</p>
              )}

              {/* Category list */}
              {categories.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">カテゴリがまだありません</p>
                  <p className="text-xs text-gray-600 mt-1">上のフォームからカテゴリを追加してください</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800/40 border border-gray-700/20 group/cat"
                    >
                      {editingCategoryId === cat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="h-7 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 rounded-md flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateCategory(cat.id);
                              if (e.key === 'Escape') { setEditingCategoryId(null); setEditingCategoryName(''); }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateCategory(cat.id)}
                            className="p-1 rounded text-green-400 hover:bg-green-500/10 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }}
                            className="p-1 rounded text-gray-400 hover:bg-gray-700/50 transition-colors text-xs"
                          >
                            &#x2715;
                          </button>
                        </div>
                      ) : (
                        <>
                          <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-sm text-gray-200 flex-1 truncate">{cat.name}</span>
                          <span className="text-[11px] text-gray-600 bg-gray-700/30 px-1.5 py-0.5 rounded-full shrink-0">
                            {cat._count.assistants}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}
                              className="p-1 bg-transparent border-0 text-white hover:opacity-60 transition-opacity"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1 bg-transparent border-0 text-white hover:opacity-60 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-gray-600 leading-relaxed">
                カテゴリを削除すると、所属するアシスタントは「未分類」に移動します。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0 bg-transparent border-none shadow-none">
          <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Dialog header */}
            <div className="sticky top-0 z-10 backdrop-blur-xl bg-gray-900/95 px-6 pt-6 pb-4 border-b border-gray-800/50 rounded-t-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-white">
                  {editingId ? 'アシスタントを編集' : '新しいアシスタント'}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  社内向けのカスタムAIアシスタントを設定します
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Name & Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">アシスタント名</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 契約書レビューAI"
                  className="h-10 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 placeholder:text-gray-500 rounded-lg"
                />
                <Input
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="説明（任意）"
                  className="h-9 text-xs bg-gray-800/40 border-gray-700/30 text-gray-300 placeholder:text-gray-600 rounded-lg"
                />
              </div>

              {/* Category select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">カテゴリ</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm(prev => ({ ...prev, categoryId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未分類</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">「カテゴリ管理」から新しいカテゴリを作成できます</p>
              </div>

              {/* System prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">システムプロンプト</Label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="例: あなたは当社の法務担当AIアシスタントです。契約書のレビュー、法的リスクの指摘、改善提案を行います。常に日本法に基づいて回答してください。"
                  rows={5}
                  className="w-full px-3 py-2.5 text-sm bg-gray-800/60 border border-gray-600/50 text-gray-100 placeholder:text-gray-500 rounded-lg resize-none focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>

              {/* Model override */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">使用モデル（任意）</Label>
                <Select
                  value={form.modelId || 'auto'}
                  onValueChange={(v) => setForm(prev => ({ ...prev, modelId: v === 'auto' ? '' : v }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">モード設定に従う（自動）</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                    <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
                    <SelectItem value="claude-opus-4-1">Claude Opus 4.1</SelectItem>
                    <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                    <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">空にするとチャット画面のモード設定が使われます</p>
              </div>

              {/* Conversation starters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-400">会話スターター</Label>
                  <button
                    onClick={addStarter}
                    className="text-xs px-2 py-0.5 rounded-md bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black transition-all duration-200 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> 追加
                  </button>
                </div>
                <div className="space-y-2">
                  {form.conversationStarters.map((starter, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                        <Input
                          value={starter}
                          onChange={(e) => updateStarter(i, e.target.value)}
                          placeholder={`例: この契約書をレビューして`}
                          className="h-8 text-xs bg-gray-800/40 border-gray-700/30 text-gray-200 placeholder:text-gray-600 rounded-lg"
                        />
                      </div>
                      {form.conversationStarters.length > 1 && (
                        <button
                          onClick={() => removeStarter(i)}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">公開範囲</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) => setForm(prev => ({ ...prev, visibility: v }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全ユーザーに公開</SelectItem>
                    <SelectItem value="owner_only">管理者のみ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 backdrop-blur-xl bg-gray-900/95 px-6 py-4 border-t border-gray-800/50 rounded-b-2xl flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
                className="flex-1 h-10 text-sm text-gray-300 hover:text-gray-100 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-10 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> 保存中</>
                ) : editingId ? (
                  '更新'
                ) : (
                  '作成'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[320px] p-0 bg-transparent border-none shadow-none">
          <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-center mb-3">
              <div className={`w-14 h-14 rounded-xl ${colorStyle(assistantToDelete?.iconColor || 'indigo').bg} border ${colorStyle(assistantToDelete?.iconColor || 'indigo').border} flex items-center justify-center text-2xl`}>
                {assistantToDelete?.iconEmoji || '🤖'}
              </div>
            </div>
            <DialogHeader className="text-center space-y-1.5">
              <DialogTitle className="text-base font-semibold text-gray-100">
                アシスタントを削除
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                「<span className="text-gray-200 font-medium">{assistantToDelete?.name}</span>」を削除しますか？
                <br />
                この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 mt-5">
              <Button
                variant="ghost"
                onClick={() => setDeleteDialogOpen(false)}
                className="flex-1 h-10 text-sm text-gray-300 hover:text-gray-100 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 h-10 text-sm bg-red-500 hover:bg-red-600 text-black hover:text-white rounded-xl"
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

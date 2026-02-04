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
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Sparkles, MessageSquare, Copy, Check } from 'lucide-react';

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
};

export function AssistantManagementSection({ token }: AssistantManagementSectionProps) {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assistantToDelete, setAssistantToDelete] = useState<Assistant | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    loadAssistants();
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

  const colorStyle = (color: string) => ICON_COLORS[color] || ICON_COLORS.indigo;

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
        <Button
          onClick={openCreateDialog}
          className="h-10 px-4 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          新規作成
        </Button>
      </div>

      {/* Assistant cards grid */}
      {assistants.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm mb-1">アシスタントがまだありません</p>
          <p className="text-gray-600 text-xs">「新規作成」で社内向けAIアシスタントを追加しましょう</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assistants.map((assistant) => {
            const cs = colorStyle(assistant.iconColor);
            const starters = JSON.parse(assistant.conversationStarters || '[]') as string[];

            return (
              <div
                key={assistant.id}
                className={`group relative backdrop-blur-xl bg-gray-900/60 border rounded-2xl p-5 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] ${
                  assistant.isActive
                    ? `border-gray-700/50 hover:${cs.border}`
                    : 'border-gray-800/30 opacity-60'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${cs.bg} border ${cs.border} flex items-center justify-center text-lg shadow-lg`}>
                      {assistant.iconEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-semibold text-sm truncate">{assistant.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{assistant.description || 'カスタムアシスタント'}</p>
                    </div>
                  </div>
                </div>

                {/* System prompt preview */}
                <div className="mb-3 relative group/prompt">
                  <div className="text-xs text-gray-400 bg-gray-800/40 rounded-lg px-3 py-2 line-clamp-2 border border-gray-700/20">
                    {assistant.systemPrompt}
                  </div>
                  <button
                    onClick={() => handleCopyPrompt(assistant.systemPrompt, assistant.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded bg-gray-700/60 opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                  >
                    {copiedPrompt === assistant.id
                      ? <Check className="w-3 h-3 text-green-400" />
                      : <Copy className="w-3 h-3 text-gray-400" />
                    }
                  </button>
                </div>

                {/* Conversation starters */}
                {starters.length > 0 && starters[0] && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {starters.slice(0, 3).map((starter, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-full ${cs.bg} ${cs.text} border ${cs.border} truncate max-w-[140px]`}
                      >
                        {starter}
                      </span>
                    ))}
                    {starters.length > 3 && (
                      <span className="text-xs text-gray-500">+{starters.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex items-center justify-between text-xs text-gray-600 pt-3 border-t border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      {assistant.visibility === 'all'
                        ? <><Eye className="w-3 h-3" /> 全員</>
                        : <><EyeOff className="w-3 h-3" /> 管理者のみ</>
                      }
                    </span>
                    {assistant.modelId && (
                      <span className="text-gray-500">{assistant.modelId}</span>
                    )}
                  </div>
                  <span>{new Date(assistant.createdAt).toLocaleDateString('ja-JP')}</span>
                </div>

                {/* Action buttons */}
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleActive(assistant)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      assistant.isActive
                        ? 'hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400'
                        : 'hover:bg-green-500/10 text-gray-500 hover:text-green-400'
                    }`}
                    title={assistant.isActive ? '無効にする' : '有効にする'}
                  >
                    {assistant.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => openEditDialog(assistant)}
                    className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-colors"
                    title="編集"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setAssistantToDelete(assistant); setDeleteDialogOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              {/* Icon & Name row */}
              <div className="flex gap-3">
                {/* Emoji picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-400">アイコン</Label>
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-xl ${colorStyle(form.iconColor).bg} border ${colorStyle(form.iconColor).border} flex items-center justify-center text-2xl cursor-pointer`}>
                      {form.iconEmoji}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5">
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
              </div>

              {/* Emoji & Color selectors */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">絵文字</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setForm(prev => ({ ...prev, iconEmoji: emoji }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        form.iconEmoji === emoji
                          ? 'bg-indigo-500/20 border border-indigo-500/40 scale-110'
                          : 'bg-gray-800/40 border border-gray-700/20 hover:bg-gray-700/40'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-400">テーマカラー</Label>
                <div className="flex gap-2">
                  {Object.entries(ICON_COLORS).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => setForm(prev => ({ ...prev, iconColor: key }))}
                      className={`w-8 h-8 rounded-full ${style.bg} border-2 transition-all ${
                        form.iconColor === key
                          ? `${style.border} scale-110 ring-2 ring-offset-2 ring-offset-gray-900 ring-${key === 'indigo' ? 'indigo' : key}-500/30`
                          : 'border-transparent hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
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
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
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

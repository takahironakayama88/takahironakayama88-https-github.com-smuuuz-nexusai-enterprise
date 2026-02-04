'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Key, LogOut, MessageSquare, User, Building2, Loader2, Sparkles, Zap, Settings, Shield, Bot } from 'lucide-react';
import { AuditSection } from '@/components/audit/AuditSection';
import { AssistantManagementSection } from '@/components/assistants/AssistantManagementSection';

interface UserData {
  id: string;
  email: string;
  role: string;
  organizationName: string;
}

interface ApiKeyStatus {
  openai: boolean;
  anthropic: boolean;
  google: boolean;
}

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
}

interface ModeSettings {
  fast: string | null;
  balanced: string | null;
  precision: string | null;
}

type Provider = 'openai' | 'anthropic' | 'google';
type ModeId = 'fast' | 'balanced' | 'precision';
type DashboardTab = 'settings' | 'assistants' | 'audit';

const PROVIDER_INFO = {
  openai: { name: 'ChatGPT', color: 'from-green-500 to-emerald-600' },
  anthropic: { name: 'Claude', color: 'from-orange-500 to-amber-600' },
  google: { name: 'Gemini', color: 'from-blue-500 to-cyan-600' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    openai: false,
    anthropic: false,
    google: false,
  });

  // ダイアログの状態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // モード設定の状態
  const [modeSettings, setModeSettings] = useState<ModeSettings>({
    fast: null,
    balanced: null,
    precision: null,
  });
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [isSavingModes, setIsSavingModes] = useState(false);
  const [modeMessage, setModeMessage] = useState('');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('settings');
  const assistantSectionRef = useRef<HTMLDivElement>(null);
  const tabNavRef = useRef<HTMLDivElement>(null);

  const handleMainClick = useCallback((e: React.MouseEvent) => {
    if (dashboardTab !== 'assistants') return;
    const target = e.target as HTMLElement;
    const mainEl = e.currentTarget as HTMLElement;
    // ポータル経由のクリック（Dialog, Select等）はDOM上<main>外なので無視
    if (!mainEl.contains(target)) return;
    if (assistantSectionRef.current?.contains(target)) return;
    if (tabNavRef.current?.contains(target)) return;
    setDashboardTab('settings');
  }, [dashboardTab]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      router.push('/login');
      return;
    }

    setToken(storedToken);
    const parsedUser = JSON.parse(storedUser);
    console.log('👤 User loaded:', parsedUser);
    console.log('👤 User role:', parsedUser.role);
    setUser(parsedUser);
    loadApiKeyStatus(storedToken);
    loadModeSettings(storedToken);
  }, [router]);

  const loadApiKeyStatus = async (authToken: string) => {
    try {
      const response = await fetch('/api/settings/api-keys', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('🔑 API key status:', data);
        setApiKeyStatus(data);
      }
    } catch (error) {
      console.error('Failed to load API key status:', error);
    }
  };

  const loadModeSettings = async (authToken: string) => {
    try {
      const response = await fetch('/api/settings/modes', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Mode settings loaded:', data);
        console.log('📊 Available models:', data.availableModels);
        setModeSettings(data.modeSettings);
        setAvailableModels(data.availableModels || []);
      } else {
        console.error('Failed to load mode settings:', response.status);
      }
    } catch (error) {
      console.error('Failed to load mode settings:', error);
    }
  };

  const saveModeSettings = async () => {
    setIsSavingModes(true);
    setModeMessage('');

    try {
      const response = await fetch('/api/settings/modes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(modeSettings),
      });

      if (response.ok) {
        setModeMessage('モード設定を保存しました');
        setTimeout(() => setModeMessage(''), 3000);
      } else {
        const data = await response.json();
        setModeMessage(data.error || 'エラーが発生しました');
      }
    } catch (error) {
      setModeMessage('モード設定の保存中にエラーが発生しました');
    } finally {
      setIsSavingModes(false);
    }
  };

  const handleModeChange = (mode: ModeId, modelId: string) => {
    setModeSettings(prev => ({
      ...prev,
      [mode]: modelId === 'none' ? null : modelId,
    }));
  };

  const handleOpenDialog = (provider: Provider) => {
    setSelectedProvider(provider);
    setApiKeyInput('');
    setSaveMessage('');
    setIsDialogOpen(true);
  };

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !apiKeyInput.trim()) {
      setSaveMessage('APIキーを入力してください');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSaveMessage('APIキーを設定しました');
        await loadApiKeyStatus(token);
        await loadModeSettings(token);  // モード設定の利用可能モデルも更新
        setTimeout(() => {
          setIsDialogOpen(false);
          setApiKeyInput('');
        }, 1500);
      } else {
        setSaveMessage(data.error || 'エラーが発生しました');
      }
    } catch (error) {
      setSaveMessage('APIキー設定中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (provider: Provider) => {
    if (!confirm(`${PROVIDER_INFO[provider].name}のAPIキーを解除しますか？`)) return;
    try {
      const response = await fetch(`/api/settings/api-keys?provider=${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await loadApiKeyStatus(token);
        await loadModeSettings(token);
      }
    } catch (error) {
      console.error('API key disconnect failed:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-950 to-gray-900">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const configuredCount = Object.values(apiKeyStatus).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-gray-900">
      {/* 背景のグロー効果 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="relative border-b border-gray-800/50 backdrop-blur-xl bg-black/40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NexusAI</h1>
              <p className="text-xs text-gray-500">{user.organizationName}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black transition-all duration-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            ログアウト
          </Button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="relative max-w-6xl mx-auto px-6 py-10" onClick={handleMainClick}>
        {/* ウェルカムセクション */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            ようこそ、{user.email.split('@')[0]}さん
          </h2>
          <p className="text-gray-400">
            AIチャットを始める前に、APIキーの設定を確認してください
          </p>
        </div>

        {/* タブナビゲーション */}
        {user.role === 'OWNER' && (
          <div ref={tabNavRef} className="flex gap-1 p-1 mb-8 backdrop-blur-xl bg-gray-800/40 rounded-lg border border-gray-700/30 w-fit">
            <button
              onClick={() => setDashboardTab('settings')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                dashboardTab === 'settings'
                  ? 'bg-black text-white border border-gray-600/50'
                  : 'bg-transparent text-white hover:bg-white hover:text-black border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              設定
            </button>
            <button
              onClick={() => setDashboardTab('assistants')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                dashboardTab === 'assistants'
                  ? 'bg-black text-white border border-gray-600/50'
                  : 'bg-transparent text-white hover:bg-white hover:text-black border border-transparent'
              }`}
            >
              <Bot className="w-4 h-4" />
              アシスタント
            </button>
            <button
              onClick={() => setDashboardTab('audit')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                dashboardTab === 'audit'
                  ? 'bg-black text-white border border-gray-600/50'
                  : 'bg-transparent text-white hover:bg-white hover:text-black border border-transparent'
              }`}
            >
              <Shield className="w-4 h-4" />
              監査ログ
            </button>
          </div>
        )}

        {/* 設定タブ */}
        {dashboardTab === 'settings' && (
        <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* ユーザー情報カード */}
          <div className="backdrop-blur-xl bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">アカウント</h3>
                <p className="text-xs text-gray-500">ログイン情報</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">メール</span>
                <span className="text-sm text-white font-mono">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">ロール</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  user.role === 'OWNER'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-gray-700/50 text-gray-300 border border-gray-600/30'
                }`}>
                  {user.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">組織</span>
                <span className="text-sm text-white flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {user.organizationName}
                </span>
              </div>
            </div>
          </div>

          {/* APIキー設定カード */}
          <div className="backdrop-blur-xl bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                <Key className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">APIキー設定</h3>
                <p className="text-xs text-gray-500">{configuredCount}/3 設定済み</p>
              </div>
            </div>
            <div className="space-y-3">
              {(['openai', 'anthropic', 'google'] as Provider[]).map((provider) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-300">{PROVIDER_INFO[provider].name}</span>
                    {apiKeyStatus[provider] ? (
                      <span className="text-[11px] text-green-400 font-medium">接続中</span>
                    ) : (
                      <span className="text-[11px] text-gray-500">未設定</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {apiKeyStatus[provider] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDisconnect(provider)}
                        disabled={user.role !== 'OWNER'}
                        className="h-7 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                      >
                        解除
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDialog(provider)}
                      disabled={user.role !== 'OWNER'}
                      className="h-7 text-xs bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black transition-all duration-200"
                    >
                      {apiKeyStatus[provider] ? '更新' : '設定'}
                    </Button>
                  </div>
                </div>
              ))}
              {user.role !== 'OWNER' && (
                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-800">
                  ※ APIキーの設定にはOWNER権限が必要です
                </p>
              )}
            </div>
          </div>

          {/* モード設定カード */}
          <div className="backdrop-blur-xl bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                <Zap className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">AIモード設定</h3>
                <p className="text-xs text-gray-500">各モードで使用するAIを設定</p>
              </div>
            </div>

            {availableModels.length === 0 ? (
              <p className="text-sm text-gray-500">
                APIキーを設定するとモデルを選択できます
              </p>
            ) : (
              <div className="space-y-4">
                {/* 高速モード */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-300">高速モード</Label>
                  <Select
                    value={modeSettings.fast || 'none'}
                    onValueChange={(v) => handleModeChange('fast', v)}
                    disabled={user.role !== 'OWNER'}
                  >
                    <SelectTrigger className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* バランスモード */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-300">バランスモード</Label>
                  <Select
                    value={modeSettings.balanced || 'none'}
                    onValueChange={(v) => handleModeChange('balanced', v)}
                    disabled={user.role !== 'OWNER'}
                  >
                    <SelectTrigger className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 高精度モード */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-300">高精度モード</Label>
                  <Select
                    value={modeSettings.precision || 'none'}
                    onValueChange={(v) => handleModeChange('precision', v)}
                    disabled={user.role !== 'OWNER'}
                  >
                    <SelectTrigger className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {user.role === 'OWNER' && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={saveModeSettings}
                      disabled={isSavingModes}
                      className="w-full h-9 text-sm bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black transition-all duration-200 rounded-lg"
                    >
                      {isSavingModes ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          保存中
                        </>
                      ) : (
                        '設定を保存'
                      )}
                    </Button>
                    {modeMessage && (
                      <p className={`text-xs mt-2 ${
                        modeMessage.includes('保存しました')
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {modeMessage}
                      </p>
                    )}
                  </div>
                )}

                {user.role !== 'OWNER' && (
                  <p className="text-xs text-gray-600 pt-2 border-t border-gray-800">
                    ※ モード設定にはOWNER権限が必要です
                  </p>
                )}
              </div>
            )}
          </div>

          {/* チャット開始カード */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">チャット</h3>
                <p className="text-xs text-gray-400">AIと対話を開始</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              API接続した複数のAIモデルと対話できます
            </p>
            <Button
              onClick={() => router.push('/chat')}
              className="w-full h-11 rounded-xl bg-black text-white border border-gray-600/50 hover:bg-white hover:text-black font-medium transition-all duration-200"
            >
              チャットを開始
            </Button>
          </div>
        </div>

        </>
        )}

        {/* アシスタントタブ */}
        {dashboardTab === 'assistants' && user.role === 'OWNER' && (
          <div ref={assistantSectionRef} className="backdrop-blur-xl bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <AssistantManagementSection token={token} />
          </div>
        )}

        {/* 監査ログタブ */}
        {dashboardTab === 'audit' && user.role === 'OWNER' && (
          <div className="backdrop-blur-xl bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <AuditSection token={token} />
          </div>
        )}
      </main>

      {/* APIキー設定ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[280px] p-0 bg-transparent border-none shadow-none">
          <div className="backdrop-blur-xl bg-gray-900/95 border border-gray-700/50 rounded-2xl p-5 shadow-2xl">
            {/* アイコン */}
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-gray-800/80 border border-gray-600/50 flex items-center justify-center">
                <Key className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* タイトル */}
            <DialogHeader className="text-center space-y-1.5">
              <DialogTitle className="text-base font-semibold text-gray-100">
                {selectedProvider && PROVIDER_INFO[selectedProvider].name} APIキー
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                暗号化して安全に保存されます
              </DialogDescription>
            </DialogHeader>

            {/* 入力フィールド */}
            <div className="space-y-3 mt-4">
              <div className="space-y-1.5 flex flex-col items-center">
                <Label htmlFor="apiKey" className="text-gray-400 text-xs">APIキー</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  disabled={isSaving}
                  className="h-9 text-sm bg-gray-800/60 border-gray-600/50 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500/60 rounded-lg w-full"
                />
              </div>

              {saveMessage && (
                <p className={`text-xs text-center ${
                  saveMessage.includes('設定しました')
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {saveMessage}
                </p>
              )}
            </div>

            {/* ボタン */}
            <div className="flex gap-2 mt-5">
              <Button
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
                className="flex-1 h-10 text-sm text-gray-300 hover:text-gray-100 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl transition-all duration-200"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSaveApiKey}
                disabled={isSaving}
                className="flex-1 h-10 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all duration-200"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    保存中
                  </>
                ) : (
                  '設定'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

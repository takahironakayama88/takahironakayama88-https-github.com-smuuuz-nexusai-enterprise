'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'ログインに失敗しました');
        setLoading(false);
        return;
      }

      // トークンをlocalStorageに保存
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // ロールに応じてリダイレクト
      if (data.user.role === 'OWNER') {
        router.push('/dashboard');
      } else {
        router.push('/chat');
      }
    } catch (err) {
      setError('ログイン処理中にエラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-950 to-gray-900 px-4">
      {/* 背景のグロー効果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            NexusAI
          </h1>
          <p className="text-gray-400">
            マルチAIチャットプラットフォーム
          </p>
        </div>

        {/* ログインカード */}
        <div className="backdrop-blur-xl bg-gray-900/60 border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 text-sm font-medium">
                メールアドレス
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 bg-gray-800/60 border-gray-600/50 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500/60 rounded-xl transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                パスワード
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 bg-gray-800/60 border-gray-600/50 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500/60 rounded-xl transition-all duration-200"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ログイン中...
                </>
              ) : (
                'ログイン'
              )}
            </Button>
          </form>

          {/* デモアカウント情報 */}
          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 text-center mb-3">デモアカウント</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmail('owner@demo.com');
                  setPassword('demo123');
                }}
                className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/30 hover:bg-gray-700/40 transition-all duration-200 text-left"
              >
                <p className="text-xs text-gray-400 mb-1">オーナー</p>
                <p className="text-sm text-gray-200 font-mono">owner@demo.com</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('member@demo.com');
                  setPassword('demo123');
                }}
                className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/30 hover:bg-gray-700/40 transition-all duration-200 text-left"
              >
                <p className="text-xs text-gray-400 mb-1">メンバー</p>
                <p className="text-sm text-gray-200 font-mono">member@demo.com</p>
              </button>
            </div>
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-gray-600 text-xs mt-6">
          NexusAI Enterprise v1.0
        </p>
      </div>
    </div>
  );
}

/**
 * AIプロバイダー設定ユーティリティ
 * 組織のAPIキーを使用してAIモデルを動的に初期化
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { decryptApiKey } from '@/lib/utils/encryption';

/**
 * モデルIDの定義
 */
export const AI_MODELS = {
  // OpenAI
  'gpt-4': { provider: 'openai', displayName: 'GPT-4', cost: 0.03 },
  'gpt-4-turbo': { provider: 'openai', displayName: 'GPT-4 Turbo', cost: 0.01 },
  'gpt-3.5-turbo': { provider: 'openai', displayName: 'GPT-3.5 Turbo', cost: 0.0005 },

  // Anthropic (2026 latest models)
  'claude-sonnet-4-5': { provider: 'anthropic', displayName: 'Claude Sonnet 4.5', cost: 0.003 },
  'claude-sonnet-4': { provider: 'anthropic', displayName: 'Claude Sonnet 4', cost: 0.003 },
  'claude-opus-4-1': { provider: 'anthropic', displayName: 'Claude Opus 4.1', cost: 0.015 },

  // Google
  'gemini-2.5-pro': { provider: 'google', displayName: 'Gemini 2.5 Pro', cost: 0.0025 },
  'gemini-2.5-flash': { provider: 'google', displayName: 'Gemini 2.5 Flash', cost: 0.0001 },
} as const;

export type ModelId = keyof typeof AI_MODELS;

/**
 * シンプル設定: プロバイダーごとの自動モード割り当て
 */
export const SIMPLE_MODE_PRESETS: Record<string, { fast: ModelId; balanced: ModelId; precision: ModelId }> = {
  openai: { fast: 'gpt-3.5-turbo', balanced: 'gpt-4-turbo', precision: 'gpt-4' },
  anthropic: { fast: 'claude-sonnet-4', balanced: 'claude-sonnet-4-5', precision: 'claude-opus-4-1' },
  google: { fast: 'gemini-2.5-flash', balanced: 'gemini-2.5-pro', precision: 'gemini-2.5-pro' },
};

/**
 * 組織のAPIキーを使用してAIモデルを取得
 */
export async function getAIModel(
  modelId: ModelId | string, // string for legacy support
  encryptedKeys: {
    encOpenaiKey?: string | null;
    encAnthropicKey?: string | null;
    encGoogleKey?: string | null;
  }
) {
  // Legacy model ID support - 古いモデルIDを新しいIDにマッピング
  const legacyModelMap: Record<string, ModelId> = {
    'claude-3-5-sonnet': 'claude-sonnet-4-5',
    'claude-3-opus': 'claude-opus-4-1',
    'claude-3-haiku': 'claude-sonnet-4',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-1.5-flash': 'gemini-2.5-flash',
  };

  const actualModelId = (legacyModelMap[modelId as string] || modelId) as ModelId;
  const modelConfig = AI_MODELS[actualModelId];

  switch (modelConfig.provider) {
    case 'openai': {
      if (!encryptedKeys.encOpenaiKey) {
        throw new Error('OpenAI APIキーが設定されていません');
      }
      const apiKey = decryptApiKey(encryptedKeys.encOpenaiKey);
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }

    case 'anthropic': {
      if (!encryptedKeys.encAnthropicKey) {
        throw new Error('Anthropic APIキーが設定されていません');
      }
      const apiKey = decryptApiKey(encryptedKeys.encAnthropicKey);
      const anthropic = createAnthropic({ apiKey });

      // Claude モデルIDを正しい形式に変換 (2026 latest models)
      const anthropicModelMap: Record<string, string> = {
        'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
        'claude-sonnet-4': 'claude-sonnet-4-20250514',
        'claude-opus-4-1': 'claude-opus-4-1-20250805',
      };

      const anthropicModelId = anthropicModelMap[actualModelId] || actualModelId;
      console.log(`🤖 Anthropic Model: ${actualModelId} -> ${anthropicModelId}`);

      return anthropic(anthropicModelId);
    }

    case 'google': {
      if (!encryptedKeys.encGoogleKey) {
        throw new Error('Google APIキーが設定されていません');
      }
      const apiKey = decryptApiKey(encryptedKeys.encGoogleKey);
      const google = createGoogleGenerativeAI({ apiKey });

      // Gemini モデルIDをそのまま使用
      console.log(`🤖 Google Model: ${actualModelId}`);

      return google(actualModelId);
    }

    default:
      throw new Error(`サポートされていないモデル: ${actualModelId}`);
  }
}

/**
 * 利用可能なモデル一覧を取得
 */
export function getAvailableModels(encryptedKeys: {
  encOpenaiKey?: string | null;
  encAnthropicKey?: string | null;
  encGoogleKey?: string | null;
}): ModelId[] {
  const availableModels: ModelId[] = [];

  for (const [modelId, config] of Object.entries(AI_MODELS)) {
    if (config.provider === 'openai' && encryptedKeys.encOpenaiKey) {
      availableModels.push(modelId as ModelId);
    } else if (config.provider === 'anthropic' && encryptedKeys.encAnthropicKey) {
      availableModels.push(modelId as ModelId);
    } else if (config.provider === 'google' && encryptedKeys.encGoogleKey) {
      availableModels.push(modelId as ModelId);
    }
  }

  return availableModels;
}

/**
 * トークンコストを計算（簡易版）
 */
export function calculateCost(modelId: ModelId, tokens: number): number {
  const costPerToken = AI_MODELS[modelId].cost / 1000; // per 1K tokens
  return tokens * costPerToken;
}

/**
 * AI監査レポート生成API（Map-Reduce方式・ストリーミング）
 * POST /api/audit/ai-report
 *
 * Phase 1 (Map): スレッドをチャンクに分割し、各チャンクを個別分析
 * Phase 2 (Reduce): 中間分析を統合して最終レポートをストリーミング生成
 */

import { NextRequest } from 'next/server';
import { streamText, generateText } from 'ai';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';
import { getAIModel, type ModelId } from '@/lib/ai/providers';

export const maxDuration = 300; // 5分（Map-Reduce全体）

/** モデル別コンテキスト上限（トークン数） */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-sonnet-4-5': 200000,
  'claude-sonnet-4': 200000,
  'claude-opus-4-1': 200000,
  'gemini-2.5-pro': 1000000,
  'gemini-2.5-flash': 1000000,
};

const PROMPT_RESERVED_TOKENS = 2000;
const OUTPUT_RESERVED_TOKENS = 4000; // Map phaseの出力は短め
const REDUCE_OUTPUT_RESERVED = 8000;

type ThreadWithMessages = {
  title: string;
  createdAt: Date;
  user: { email: string };
  messages: Array<{
    role: string;
    content: string;
    modelId: string;
    tokensUsed: number;
    createdAt: Date;
  }>;
};

function serializeThreads(threads: ThreadWithMessages[]): string {
  const parts: string[] = [];
  for (const thread of threads) {
    const lines: string[] = [];
    lines.push(`=== スレッド: ${thread.title} ===`);
    lines.push(`ユーザー: ${thread.user.email} | 作成日: ${thread.createdAt.toISOString().slice(0, 10)}`);
    lines.push('---');
    for (const msg of thread.messages) {
      const time = msg.createdAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const role = msg.role === 'user' ? 'ユーザー' : 'AI';
      lines.push(`[${time}] ${role} (${msg.modelId}, ${msg.tokensUsed}tokens): ${msg.content}`);
    }
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

/** スレッドをトークン予算内のチャンクに分割 */
function splitIntoChunks(threads: ThreadWithMessages[], tokenBudgetPerChunk: number): ThreadWithMessages[][] {
  const chunks: ThreadWithMessages[][] = [];
  let currentChunk: ThreadWithMessages[] = [];
  let currentTokens = 0;

  for (const thread of threads) {
    const threadText = serializeThreads([thread]);
    const threadTokens = estimateTokens(threadText);

    if (currentChunk.length > 0 && currentTokens + threadTokens > tokenBudgetPerChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(thread);
    currentTokens += threadTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

const MAP_SYSTEM_PROMPT = `あなたは企業AIチャットの監査分析アシスタントです。
提示されたチャットデータのチャンク（一部）を分析し、以下の観点で簡潔に要約してください。
これは最終レポートではなく中間分析です。事実ベースで箇条書き中心に記述してください。

## 分析観点

### トピック概要
- 各スレッドの主要トピックを1行で要約
- 業務関連/業務外の分類

### 機密情報リスク
- 個人情報（PII）の検出（具体的な内容はマスクし、種類と該当スレッドを記載）
- 認証情報・APIキー・パスワード等の検出
- 社内機密データの言及

### 不適切利用
- 業務外利用やポリシー違反の可能性

### 利用統計
- ユーザー別メッセージ数
- 使用モデルの内訳
- トークン使用量の概算

### リスク検出項目
- 検出されたリスクを重要度順にリスト化（高/中/低）`;

function buildReducePrompt(totalThreads: number, totalMessages: number, dateFrom: string, dateTo: string): string {
  return `あなたは企業のAIチャット利用状況を監査する専門のセキュリティ監査員です。
複数チャンクに分割して分析された中間レポートが以下に提示されます。
これらを統合し、包括的な最終監査レポートを日本語で作成してください。

## 監査対象情報
- 期間: ${dateFrom} 〜 ${dateTo}
- 総スレッド数: ${totalThreads}
- 総メッセージ数: ${totalMessages}

## レポート構成

以下の構成に従い、各セクションに見出し（##）を付けて報告してください。

### 1. エグゼクティブサマリー
- 監査対象期間、スレッド数、メッセージ数、ユーザー数の概要
- 主要な発見事項（3〜5点）
- 全体的なリスクレベル評価（低／中／高）

### 2. 会話トピック分類
- 主要なトピックカテゴリを特定し、各カテゴリのスレッド数を示す
- 業務関連度の評価

### 3. 機密情報漏洩リスク検出
- 個人情報（PII）の検出: 氏名、メールアドレス、電話番号、住所等
- 認証情報の検出: パスワード、APIキー、トークン、シークレット等
- 内部データの検出: 社内文書、顧客データ、財務情報、契約内容等
- 各検出項目のリスクレベルと該当スレッドの特定

### 4. 不適切利用チェック
- 業務外利用の検出（私的な質問、娯楽目的等）
- ポリシー違反の可能性がある利用パターン
- 不適切なコンテンツの有無

### 5. 利用パターン分析
- ユーザー別の利用頻度と傾向
- 時間帯別の利用パターン
- よく使われるAIモデルの傾向
- トークン使用量の分析

### 6. コンプライアンスリスク評価
- 情報セキュリティポリシーへの準拠状況
- データ保護に関するリスク
- 規制要件（個人情報保護法等）への影響

### 7. 改善提案
- 検出されたリスクへの対策案
- AIチャット利用ポリシーの改善提案
- モニタリング強化の推奨事項

## 注意事項
- 具体的な会話内容を引用する場合は、機密情報をマスクしてください
- 各セクションで該当がない場合は「該当なし」と明記してください
- リスク評価は客観的な基準に基づいて行ってください
- 中間分析に重複がある場合はマージしてください

## 中間分析データ
以下の中間分析を統合してレポートを作成してください。`;
}

export async function POST(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return new Response('認証が必要です', { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return new Response('OWNER権限が必要です', { status: 403 });
  }

  try {
    const body = await request.json();
    const { from, to, userId } = body as { from: string; to: string; userId?: string };

    if (!from || !to) {
      return new Response('日付範囲を指定してください', { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: decoded.organizationId },
    });

    if (!organization) {
      return new Response('組織が見つかりません', { status: 404 });
    }

    const modelId = (
      organization.precisionModeModel ||
      organization.balancedModeModel ||
      organization.fastModeModel
    ) as ModelId | null;

    if (!modelId) {
      return new Response(
        'AIモデルが設定されていません。ダッシュボードでモデルを設定してください。',
        { status: 400 }
      );
    }

    const model = await getAIModel(modelId, {
      encOpenaiKey: organization.encOpenaiKey,
      encAnthropicKey: organization.encAnthropicKey,
      encGoogleKey: organization.encGoogleKey,
    });

    const dateFrom = new Date(from);
    const dateTo = new Date(to + 'T23:59:59.999Z');

    const threadWhere: Record<string, unknown> = {
      organizationId: decoded.organizationId,
      createdAt: { gte: dateFrom, lte: dateTo },
    };
    if (userId) {
      threadWhere.userId = userId;
    }

    const threads = await prisma.thread.findMany({
      where: threadWhere,
      include: {
        user: { select: { email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (threads.length === 0) {
      return new Response('対象期間にチャットデータがありません', { status: 400 });
    }

    const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0);

    // コンテキスト予算を計算してチャンクに分割
    const contextLimit = MODEL_CONTEXT_LIMITS[modelId] || 128000;
    const mapDataBudget = contextLimit - PROMPT_RESERVED_TOKENS - OUTPUT_RESERVED_TOKENS;
    const chunks = splitIntoChunks(threads, mapDataBudget);

    let totalTokensUsed = 0;

    // カスタムストリームでMap-Reduce実行
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const intermediateResults: string[] = [];

          if (chunks.length === 1) {
            // チャンク1つ = 従来の直接分析（Map不要）
            controller.enqueue(encoder.encode(`[PROGRESS]0/1/direct\n`));

            const serialized = serializeThreads(chunks[0]);
            const reducePrompt = buildReducePrompt(threads.length, totalMessages, from, to);

            const result = streamText({
              model,
              messages: [
                { role: 'system', content: reducePrompt },
                { role: 'user', content: serialized },
              ],
              async onFinish({ usage }) {
                totalTokensUsed += (usage.inputTokens || 0) + (usage.outputTokens || 0);
              },
            });

            controller.enqueue(encoder.encode('[REPORT]\n'));

            for await (const chunk of result.textStream) {
              controller.enqueue(encoder.encode(chunk));
            }
          } else {
            // Map-Reduce: 複数チャンクの場合
            // Phase 1: Map - 各チャンクを個別分析
            for (let i = 0; i < chunks.length; i++) {
              controller.enqueue(
                encoder.encode(`[PROGRESS]${i + 1}/${chunks.length}/map\n`)
              );

              const chunkData = serializeThreads(chunks[i]);
              const chunkThreadCount = chunks[i].length;
              const chunkMsgCount = chunks[i].reduce((s, t) => s + t.messages.length, 0);

              const { text, usage } = await generateText({
                model,
                messages: [
                  { role: 'system', content: MAP_SYSTEM_PROMPT },
                  {
                    role: 'user',
                    content: `以下はチャンク ${i + 1}/${chunks.length}（${chunkThreadCount}スレッド、${chunkMsgCount}メッセージ）です。\n\n${chunkData}`,
                  },
                ],
              });

              totalTokensUsed += (usage.inputTokens || 0) + (usage.outputTokens || 0);
              intermediateResults.push(
                `--- チャンク ${i + 1}/${chunks.length} の分析結果（${chunkThreadCount}スレッド、${chunkMsgCount}メッセージ）---\n${text}`
              );
            }

            // Phase 2: Reduce - 中間分析を統合して最終レポート
            controller.enqueue(encoder.encode(`[PROGRESS]0/0/reduce\n`));

            const combinedAnalysis = intermediateResults.join('\n\n');
            const reducePrompt = buildReducePrompt(threads.length, totalMessages, from, to);

            const result = streamText({
              model,
              messages: [
                { role: 'system', content: reducePrompt },
                { role: 'user', content: combinedAnalysis },
              ],
              async onFinish({ usage }) {
                totalTokensUsed += (usage.inputTokens || 0) + (usage.outputTokens || 0);
              },
            });

            controller.enqueue(encoder.encode('[REPORT]\n'));

            for await (const chunk of result.textStream) {
              controller.enqueue(encoder.encode(chunk));
            }
          }

          // トークン使用量を更新
          if (totalTokensUsed > 0) {
            await prisma.organization.update({
              where: { id: organization.id },
              data: { currentUsage: { increment: totalTokensUsed } },
            });
          }

          controller.close();
        } catch (err) {
          console.error('AI report stream error:', err);
          const msg = err instanceof Error ? err.message : 'レポート生成中にエラーが発生しました';
          controller.enqueue(encoder.encode(`\n\n[エラー: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('AI report generation error:', error);
    const message = error instanceof Error ? error.message : 'レポート生成中にエラーが発生しました';
    return new Response(message, { status: 500 });
  }
}

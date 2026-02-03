/**
 * チャットAPIエンドポイント
 * POST /api/chat
 * ストリーミングレスポンス対応
 */

import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { prisma } from '@/lib/db/prisma';
import { getAIModel, calculateCost, type ModelId } from '@/lib/ai/providers';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// JWTペイロードの型定義
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export async function POST(request: NextRequest) {
  try {
    // 認証確認
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('認証が必要です', { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: JWTPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return new Response('無効な認証トークンです', { status: 401 });
    }

    // リクエストボディの解析
    const body = await request.json();
    const { messages: rawMessages, modeId, threadId, attachments } = body as {
      messages: Array<any>;
      modeId: 'fast' | 'balanced' | 'precision';
      threadId?: string;
      attachments?: Array<{
        name: string;
        type: string;
        isImage: boolean;
        base64Data: string;
      }>;
    };

    // AI SDK v6: parts配列形式のメッセージをcontent形式に正規化
    const messages = rawMessages.map((msg, index) => {
      if (msg.role === 'assistant' && msg.parts) {
        // アシスタントメッセージはparts配列からcontentを抽出
        return {
          role: msg.role,
          content: msg.parts.map((part: any) => part.text || '').join(''),
        };
      }

      // 最後のユーザーメッセージに添付ファイルを追加
      if (msg.role === 'user' && index === rawMessages.length - 1 && attachments && attachments.length > 0) {
        // マルチモーダルコンテンツを構築
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];

        // 画像添付を追加
        for (const attachment of attachments) {
          if (attachment.isImage) {
            contentParts.push({
              type: 'image',
              image: attachment.base64Data,
            });
          }
        }

        // テキストメッセージを追加
        let textContent = msg.content || '';

        // 非画像ファイルの情報をテキストに追加
        const nonImageFiles = attachments.filter(a => !a.isImage);
        if (nonImageFiles.length > 0) {
          const fileInfo = nonImageFiles.map(f => `[添付ファイル: ${f.name}]`).join('\n');
          textContent = `${fileInfo}\n\n${textContent}`;
        }

        contentParts.push({
          type: 'text',
          text: textContent,
        });

        return {
          role: msg.role,
          content: contentParts,
        };
      }

      // 通常のユーザーメッセージ
      return {
        role: msg.role,
        content: msg.content || '',
      };
    });

    // ログ用にコンテンツを取得（配列の場合はテキスト部分を抽出）
    const lastContent = messages?.[messages.length - 1]?.content;
    const lastMessagePreview = typeof lastContent === 'string'
      ? lastContent.substring(0, 50)
      : Array.isArray(lastContent)
        ? lastContent.find((p: any) => p.type === 'text')?.text?.substring(0, 50) || '[multimodal]'
        : '';

    console.log('📥 Chat API Request:', {
      messageCount: messages?.length,
      modeId,
      threadId,
      lastMessage: lastMessagePreview,
      hasAttachments: attachments && attachments.length > 0,
    });

    if (!messages || !modeId) {
      return new Response('messagesとmodeIdは必須です', { status: 400 });
    }

    // 組織情報を取得（モード設定を含む）
    const organization = await prisma.organization.findUnique({
      where: { id: decoded.organizationId },
    });

    if (!organization) {
      return new Response('組織が見つかりません', { status: 404 });
    }

    // モードからモデルIDを解決
    const modeToModelMap: Record<string, string | null> = {
      fast: organization.fastModeModel,
      balanced: organization.balancedModeModel,
      precision: organization.precisionModeModel,
    };

    const modelId = modeToModelMap[modeId] as ModelId | null;

    if (!modelId) {
      return new Response(`${modeId}モードのモデルが設定されていません`, { status: 400 });
    }

    console.log(`🔄 Mode ${modeId} -> Model ${modelId}`);

    // クォータチェック
    if (organization.currentUsage >= organization.tokenMonthlyLimit) {
      return new Response('月間トークン制限に達しました', { status: 403 });
    }

    // AIモデルを取得
    const model = await getAIModel(modelId, {
      encOpenaiKey: organization.encOpenaiKey,
      encAnthropicKey: organization.encAnthropicKey,
      encGoogleKey: organization.encGoogleKey,
    });

    // AI SDK v6: ストリーミングレスポンスを生成
    const result = streamText({
      model,
      messages,
      async onFinish({ usage, text }) {
        // トークン使用量を記録
        const tokensUsed = (usage.promptTokens || 0) + (usage.completionTokens || 0);
        const cost = calculateCost(modelId, tokensUsed);

        // 組織の使用量を更新
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            currentUsage: {
              increment: tokensUsed,
            },
          },
        });

        // スレッドが指定されている場合、メッセージを保存
        if (threadId) {
          // ユーザーメッセージを保存
          const userMessage = messages[messages.length - 1];
          await prisma.message.create({
            data: {
              threadId,
              role: 'user',
              content: userMessage.content,
              modelId,
              tokensUsed: usage.promptTokens || 0,
              costEstimate: 0,
            },
          });

          // アシスタントメッセージを保存
          await prisma.message.create({
            data: {
              threadId,
              role: 'assistant',
              content: text,
              modelId,
              tokensUsed: usage.completionTokens || 0,
              costEstimate: cost,
            },
          });
        }
      },
    });

    // AI SDK v6: UI Message Stream形式でレスポンスを返す（useChatと互換性あり）
    console.log('📤 Returning stream response');
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'チャット処理中にエラーが発生しました';
    return new Response(errorMessage, { status: 500 });
  }
}

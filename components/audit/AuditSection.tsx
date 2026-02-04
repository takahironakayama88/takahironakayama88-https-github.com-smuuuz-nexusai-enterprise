'use client';

import { useState } from 'react';
import { OperationLogPanel } from './OperationLogPanel';
import { ChatAuditPanel } from './ChatAuditPanel';
import { AIAuditReportPanel } from './AIAuditReportPanel';
import { FileText, MessageSquare, Sparkles } from 'lucide-react';

interface AuditSectionProps {
  token: string;
}

const SUB_TABS = [
  { id: 'logs', label: '操作ログ', icon: FileText },
  { id: 'chats', label: 'チャット監査', icon: MessageSquare },
  { id: 'ai-report', label: 'AI監査', icon: Sparkles },
] as const;

type SubTabId = typeof SUB_TABS[number]['id'];

export function AuditSection({ token }: AuditSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTabId>('logs');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 backdrop-blur-xl bg-gray-800/40 rounded-lg border border-gray-700/30 w-fit">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      {activeTab === 'logs' && <OperationLogPanel token={token} />}
      {activeTab === 'chats' && <ChatAuditPanel token={token} />}
      {activeTab === 'ai-report' && <AIAuditReportPanel token={token} />}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useConversations,
  useConversation,
  useCreateConversation,
  useSendMessage,
  useDeleteConversation,
  type AiConversation,
  type AiChatMessage,
} from '@/lib/api/ai-hooks';
import { Sparkles, Plus, Send, Trash2, MessageSquare, Bot, User, Loader2, ChevronLeft } from 'lucide-react';

export default function AiChatPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const { data: convList, isLoading: loadingList } = useConversations();
  const { data: convDetail, isLoading: loadingDetail } = useConversation(selectedId);
  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();

  const conversations = convList?.data || [];
  const messages: AiChatMessage[] = convDetail?.data?.messages || [];

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const handleNewConversation = useCallback(async () => {
    try {
      const result = await createConv.mutateAsync({});
      setSelectedId(result.data.id);
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
      setInput('');
    } catch {
      // ignore
    }
  }, [createConv, queryClient]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedId || isSending) return;

    const content = input.trim();
    setInput('');
    setIsSending(true);

    try {
      // Use direct fetch to avoid hook issues
      const token = localStorage.getItem('accessToken') || '';
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const resp = await fetch(`${baseUrl}/ai/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (resp.ok) {
        // Refetch conversation
        queryClient.invalidateQueries({ queryKey: ['ai', 'conversation', selectedId] });
        queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
      }
    } catch {
      // ignore
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, selectedId, isSending, queryClient]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await deleteConv.mutateAsync(id);
      if (selectedId === id) setSelectedId(undefined);
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    } catch {
      // ignore
    }
  }, [deleteConv, selectedId, queryClient]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-72 border-r border-border flex flex-col bg-muted/30">
          {/* Sidebar header */}
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-sm flex-1">AI Chat</h2>
            <button
              onClick={handleNewConversation}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No conversations yet.<br />Click + to start.
              </div>
            ) : (
              conversations.map((conv: AiConversation) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-accent/50 transition-colors ${
                    selectedId === conv.id ? 'bg-accent' : ''
                  }`}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.messageCount} messages
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="p-4 rounded-full bg-amber-500/10">
              <Sparkles className="h-10 w-10 text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">ARIS AI Assistant</h2>
            <p className="text-sm max-w-md text-center">
              Ask questions about animal health, livestock data, trade statistics,
              or get help with ARIS features and workflows.
            </p>
            <button
              onClick={handleNewConversation}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New Conversation
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1 rounded hover:bg-accent lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Bot className="h-5 w-5 text-amber-500" />
              <span className="font-medium text-sm truncate">
                {convDetail?.data?.title || 'Loading...'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {convDetail?.data?.model || 'qwen2.5:32b'}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {loadingDetail ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Send a message to start the conversation.
                </div>
              ) : (
                messages.map((msg: AiChatMessage) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role !== 'USER' && (
                      <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-amber-500" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'USER'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.role === 'ASSISTANT' && msg.durationMs > 0 && (
                        <div className="text-[10px] mt-1 opacity-50">
                          {(msg.durationMs / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                    {msg.role === 'USER' && (
                      <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border p-4">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask ARIS AI..."
                  rows={1}
                  disabled={isSending}
                  className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 max-h-32"
                  style={{ minHeight: '44px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-center mt-2 text-muted-foreground">
                ARIS AI uses Qwen 2.5 running locally on AU-IBAR infrastructure. No data is sent to external services.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

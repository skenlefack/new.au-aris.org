// React Query hooks for the Support module.
//
// Wraps the support backend (services/support) and covers
// ticket CRUD, comments, escalation, and SLA stats.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = ['TECHNICAL', 'DATA_QUALITY', 'ACCESS', 'GENERAL'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface TicketSLA {
  id: string;
  ticket_id: string;
  category: TicketCategory;
  priority: TicketPriority;
  deadline: string;
  response_target: string;
  responded_at: string | null;
  breached_at: string | null;
  breached: boolean;
  created_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  content: string;
  is_internal: boolean;
  created_by: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  reference: string;
  tenant_id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: string;
  assigned_to: string | null;
  escalated_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_deadline: string;
  sla_breached: boolean;
  attachment_keys: string[];
  comments?: TicketComment[];
  sla?: TicketSLA | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketDto {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  attachmentKeys?: string[];
}

export interface UpdateTicketDto {
  status?: TicketStatus;
  assignedTo?: string;
  priority?: TicketPriority;
}

export interface EscalateDto {
  targetTenantId: string;
  reason?: string;
}

export interface AddCommentDto {
  content: string;
  isInternal?: boolean;
}

export interface SlaStats {
  period: string;
  total: number;
  breached: number;
  resolved: number;
  slaComplianceRate: string;
  avgResolutionHours: number;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface TicketFilters {
  page?: number;
  limit?: number;
  status?: TicketStatus | '';
  category?: TicketCategory | '';
  priority?: TicketPriority | '';
}

function toQuery(f?: TicketFilters): Record<string, string> {
  const qp: Record<string, string> = {};
  if (!f) return qp;
  if (f.page) qp.page = String(f.page);
  if (f.limit) qp.limit = String(f.limit);
  if (f.status) qp.status = f.status;
  if (f.category) qp.category = f.category;
  if (f.priority) qp.priority = f.priority;
  return qp;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useSupportTickets(filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ['support', 'tickets', filters],
    queryFn: () =>
      apiClient.get<{ data: SupportTicket[]; meta: { total: number; page: number; limit: number } }>(
        '/support/tickets',
        toQuery(filters),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () =>
      apiClient.get<{ data: SupportTicket }>(`/support/tickets/${id}`),
    enabled: !!id,
  });
}

export function useTicketComments(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['support', 'comments', ticketId],
    queryFn: () =>
      apiClient.get<{ data: TicketComment[] }>(`/support/tickets/${ticketId}/comments`),
    enabled: !!ticketId,
  });
}

export function useSlaStats(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['support', 'sla-stats', period],
    queryFn: () =>
      apiClient.get<{ data: SlaStats }>('/support/sla/stats', { period }),
    staleTime: 60_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketDto) =>
      apiClient.post<{ data: SupportTicket }>('/support/tickets', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateTicketDto) =>
      apiClient.patch<{ data: SupportTicket }>(`/support/tickets/${id}`, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['support', 'ticket', vars.id] });
    },
  });
}

export function useEscalateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & EscalateDto) =>
      apiClient.post<{ data: SupportTicket }>(`/support/tickets/${id}/escalate`, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['support', 'ticket', vars.id] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, ...input }: { ticketId: string } & AddCommentDto) =>
      apiClient.post<{ data: TicketComment }>(`/support/tickets/${ticketId}/comments`, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support', 'comments', vars.ticketId] });
      qc.invalidateQueries({ queryKey: ['support', 'ticket', vars.ticketId] });
    },
  });
}

// ─── Badge helpers ──────────────────────────────────────────────────────────

export function statusBadgeClasses(status: TicketStatus): string {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'ESCALATED':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'RESOLVED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'CLOSED':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function priorityBadgeClasses(priority: TicketPriority): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'LOW':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function categoryBadgeClasses(category: TicketCategory): string {
  switch (category) {
    case 'TECHNICAL':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'DATA_QUALITY':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'ACCESS':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
    case 'GENERAL':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programmeMonitoringClient } from './client';

const BASE = '/programme-monitoring';

// ── Programmes ──

export function useProgrammes(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['programmes', params],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes`, params),
    staleTime: 60_000,
  });
}

export function useProgramme(id: string | undefined) {
  return useQuery({
    queryKey: ['programme', id],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateProgramme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => programmeMonitoringClient.post<any>(`${BASE}/programmes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programmes'] }),
  });
}

export function useUpdateProgramme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.patch<any>(`${BASE}/programmes/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programmes'] }),
  });
}

// ── Dashboard ──

export function useProgrammeDashboard(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['programme-dashboard', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/dashboard`),
    enabled: !!programmeId,
    staleTime: 30_000,
  });
}

export function useBudgetSummary(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['budget-summary', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/budget-summary`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

export function useRegionalBreakdown(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['regional-breakdown', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/regional`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

export function useGanttData(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['gantt-data', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/gantt`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

export function useBurnRate(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['burn-rate', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/burn-rate`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

// ── Activities ──

export function useActivities(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['pm-activities', params],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/activities`, params),
    staleTime: 30_000,
  });
}

export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['pm-activity', id],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/activities/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.patch<any>(`${BASE}/activities/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-activities'] });
      qc.invalidateQueries({ queryKey: ['programme-dashboard'] });
    },
  });
}

// ── Budgets ──

export function useBudgets(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['pm-budgets', params],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/budgets`, params),
    staleTime: 60_000,
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.patch<any>(`${BASE}/budgets/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-budgets'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
      qc.invalidateQueries({ queryKey: ['programme-dashboard'] });
    },
  });
}

// ── Reporting Cycles ──

export function useReportingCycles(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['reporting-cycles', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/cycles`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

export function useReportingCycle(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['reporting-cycle', cycleId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/cycles/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 30_000,
  });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programmeId, ...body }: any) =>
      programmeMonitoringClient.post<any>(`${BASE}/programmes/${programmeId}/cycles`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reporting-cycles'] }),
  });
}

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, ...body }: any) =>
      programmeMonitoringClient.post<any>(`${BASE}/cycles/${cycleId}/reports`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reporting-cycles'] });
      qc.invalidateQueries({ queryKey: ['reporting-cycle'] });
    },
  });
}

// ── Activities mutations ──

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => programmeMonitoringClient.post<any>(`${BASE}/activities`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-activities'] });
      qc.invalidateQueries({ queryKey: ['programme-dashboard'] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => programmeMonitoringClient.delete<any>(`${BASE}/activities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-activities'] });
      qc.invalidateQueries({ queryKey: ['programme-dashboard'] });
    },
  });
}

// ── Budgets mutations ──

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => programmeMonitoringClient.post<any>(`${BASE}/budgets`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm-budgets'] });
      qc.invalidateQueries({ queryKey: ['budget-summary'] });
      qc.invalidateQueries({ queryKey: ['programme-dashboard'] });
    },
  });
}

// ── Indicators ──

export function useIndicators(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['pm-indicators', params],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/indicators`, params),
    staleTime: 60_000,
  });
}

export function useCreateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => programmeMonitoringClient.post<any>(`${BASE}/indicators`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-indicators'] }),
  });
}

export function useUpdateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.patch<any>(`${BASE}/indicators/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-indicators'] }),
  });
}

export function useAddIndicatorValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ indicatorId, ...body }: any) => programmeMonitoringClient.post<any>(`${BASE}/indicators/${indicatorId}/values`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-indicators'] }),
  });
}

// ── Risks ──

export function useRisks(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['pm-risks', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/risks`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

export function useCreateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programmeId, ...body }: any) => programmeMonitoringClient.post<any>(`${BASE}/programmes/${programmeId}/risks`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-risks'] }),
  });
}

export function useUpdateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.patch<any>(`${BASE}/risks/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-risks'] }),
  });
}

// ── Team ──

export function useTeam(programmeId: string | undefined) {
  return useQuery({
    queryKey: ['pm-team', programmeId],
    queryFn: () => programmeMonitoringClient.get<any>(`${BASE}/programmes/${programmeId}/team`),
    enabled: !!programmeId,
    staleTime: 60_000,
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programmeId, ...body }: any) => programmeMonitoringClient.post<any>(`${BASE}/programmes/${programmeId}/team`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-team'] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programmeId, userId }: { programmeId: string; userId: string }) =>
      programmeMonitoringClient.delete<any>(`${BASE}/programmes/${programmeId}/team/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm-team'] }),
  });
}

// ── Reporting mutations ──

export function useValidateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.post<any>(`${BASE}/reports/${id}/validate`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reporting-cycles'] });
      qc.invalidateQueries({ queryKey: ['reporting-cycle'] });
    },
  });
}

export function useUpdateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => programmeMonitoringClient.patch<any>(`${BASE}/cycles/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reporting-cycles'] }),
  });
}

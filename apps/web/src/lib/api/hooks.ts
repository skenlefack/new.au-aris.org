import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { useAuthStore } from '../stores/auth-store';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      tenantId: string;
    };
  };
}

interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface DashboardKpis {
  data: {
    activeOutbreaks: number;
    vaccinationCoverage: number;
    pendingValidations: number;
    dataQualityScore: number;
    outbreaksTrend: number;
    vaccinationTrend: number;
    validationsTrend: number;
    qualityTrend: number;
  };
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (data: LoginRequest) =>
      apiClient.post<LoginResponse>('/credential/login', data),
    onSuccess: (res) => {
      const { user, accessToken, refreshToken } = res.data;
      setAuth(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as ReturnType<typeof useAuthStore.getState>['user'] extends null ? never : NonNullable<ReturnType<typeof useAuthStore.getState>['user']>['role'],
          tenantId: user.tenantId,
        },
        accessToken,
        refreshToken,
      );
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: RegisterRequest) =>
      apiClient.post<{ data: { id: string } }>('/credential/register', data),
  });
}

export function useDashboardKpis() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => apiClient.get<DashboardKpis>('/analytics/dashboard/kpis'),
    placeholderData: {
      data: {
        activeOutbreaks: 42,
        vaccinationCoverage: 87.3,
        pendingValidations: 156,
        dataQualityScore: 94.1,
        outbreaksTrend: 12,
        vaccinationTrend: 5.2,
        validationsTrend: -8,
        qualityTrend: 0,
      },
    },
  });
}

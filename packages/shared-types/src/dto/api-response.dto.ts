export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiResponseMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ApiResponseMeta;
  errors?: ApiErrorDetail[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: ApiResponseMeta;
}

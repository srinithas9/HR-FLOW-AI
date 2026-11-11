export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  detail: string | { message?: string; error?: string; [key: string]: unknown };
}


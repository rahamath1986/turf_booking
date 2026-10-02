import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

function getTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return {
    access: localStorage.getItem('admin_access_token'),
    refresh: localStorage.getItem('admin_refresh_token'),
  };
}

function setTokens(access: string, refresh?: string) {
  localStorage.setItem('admin_access_token', access);
  if (refresh) localStorage.setItem('admin_refresh_token', refresh);
}

function clearAuthAndRedirect() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login';
}

// Single-flight refresh: concurrent 401s share one refresh call.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refresh } = getTokens();
      if (!refresh) throw new Error('No refresh token');
      // Bare axios call (no interceptors) to avoid loops.
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
        refreshToken: refresh,
      });
      const payload = data?.data ?? data;
      const accessToken: string | undefined =
        payload.accessToken || payload.authToken || payload.token;
      const newRefresh: string | undefined = payload.refreshToken;
      if (!accessToken) throw new Error('Refresh did not return a token');
      setTokens(accessToken, newRefresh);
      return accessToken;
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }
  return refreshPromise;
}

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: try refresh once on 401, then retry; else logout.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url || '';

    // Don't intercept the refresh call itself or non-401s.
    if (!original || status !== 401 || original._retry || url.includes('/auth/refresh-token')) {
      if (status === 401 && !url.includes('/auth/')) {
        clearAuthAndRedirect();
      }
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const accessToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }
  },
);

// Backend wraps all responses via TransformInterceptor:
// { success, statusCode, data, timestamp }. Unwrap to payload.
export function unwrap<T>(axiosData: unknown): T {
  if (
    axiosData &&
    typeof axiosData === 'object' &&
    'data' in (axiosData as Record<string, unknown>)
  ) {
    return (axiosData as Record<string, unknown>).data as T;
  }
  return axiosData as T;
}

export default api;

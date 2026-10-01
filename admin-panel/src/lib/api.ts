import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

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

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
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

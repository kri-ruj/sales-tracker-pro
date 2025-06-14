// API service for frontend

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ApiResponse, User, Activity, LoginRequest, TeamStats } from '@shared/types';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  clearToken(): void {
    this.setToken(null);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private handleError(error: AxiosError): Error {
    if (error.response?.data) {
      const apiError = error.response.data as any;
      return new Error(apiError.error?.message || 'An error occurred');
    }
    if (error.request) {
      return new Error('Network error. Please check your connection.');
    }
    return new Error(error.message || 'An unexpected error occurred');
  }

  // Auth endpoints
  async login(request: LoginRequest): Promise<{ user: User; token: string }> {
    const response = await this.client.post<ApiResponse<{ user: User; token: string }>>(
      '/auth/login',
      request
    );
    
    if (response.data.data) {
      this.setToken(response.data.data.token);
      return response.data.data;
    }
    
    throw new Error('Invalid response from server');
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  async getProfile(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/auth/me');
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>('/auth/me', updates);
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  }

  // Activity endpoints
  async getActivities(params?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<Activity[]> {
    const response = await this.client.get<ApiResponse<Activity[]>>('/activities', { params });
    return response.data.data || [];
  }

  async createActivity(activity: {
    type: string;
    description: string;
    metadata?: any;
  }): Promise<Activity> {
    const response = await this.client.post<ApiResponse<Activity>>('/activities', activity);
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  }

  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity> {
    const response = await this.client.put<ApiResponse<Activity>>(`/activities/${id}`, updates);
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  }

  async deleteActivity(id: string): Promise<void> {
    await this.client.delete(`/activities/${id}`);
  }

  async getActivityStats(startDate?: string, endDate?: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/activities/stats', {
      params: { startDate, endDate }
    });
    return response.data.data;
  }

  // Team endpoints
  async getTeamStats(period: 'daily' | 'weekly' | 'monthly'): Promise<TeamStats> {
    const response = await this.client.get<ApiResponse<any>>('/team/stats', {
      params: { period }
    });
    return response.data.data;
  }

  async getLeaderboard(period: 'daily' | 'weekly' | 'monthly', limit?: number): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/team/leaderboard/${period}`, {
      params: { limit }
    });
    return response.data.data;
  }

  // User endpoints
  async getUsers(params?: { limit?: number; offset?: number }): Promise<User[]> {
    const response = await this.client.get<ApiResponse<User[]>>('/users', { params });
    return response.data.data || [];
  }

  async getUser(id: string): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>(`/users/${id}`);
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  }

  // Generic request method for custom endpoints
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<ApiResponse<T>>(config);
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Initialize token from localStorage
const savedToken = localStorage.getItem('token');
if (savedToken) {
  apiService.setToken(savedToken);
}
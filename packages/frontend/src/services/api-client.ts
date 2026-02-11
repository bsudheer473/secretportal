/**
 * API client for backend communication using Axios
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import config from '../config/environment';
import {
  Secret,
  SecretDetail,
  CreateSecretRequest,
  UpdateSecretRequest,
  UpdateRotationPeriodRequest,
  SearchFilters,
  ListSecretsResponse,
  ConsoleUrlResponse,
  AuditLogResponse,
  ErrorResponse,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = sessionStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          sessionStorage.removeItem('authToken');
          window.location.href = '/login';
        } else if (error.response?.status === 403) {
          // Redirect to access denied page
          window.location.href = '/access-denied';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * List secrets with optional filtering
   */
  async listSecrets(filters?: SearchFilters): Promise<ListSecretsResponse> {
    const params = new URLSearchParams();
    if (filters?.application) params.append('application', filters.application);
    if (filters?.environment) params.append('environment', filters.environment);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.nextToken) params.append('nextToken', filters.nextToken);

    const response = await this.client.get<ListSecretsResponse>(
      `/secrets?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get secret metadata by ID
   */
  async getSecret(secretId: string): Promise<SecretDetail> {
    const response = await this.client.get<SecretDetail>(`/secrets/${secretId}`);
    return response.data;
  }

  /**
   * Get AWS console URL for a secret
   */
  async getConsoleUrl(secretId: string): Promise<string> {
    const response = await this.client.get<ConsoleUrlResponse>(
      `/secrets/${secretId}/console-url`
    );
    return response.data.url;
  }

  /**
   * Create a new secret
   */
  async createSecret(request: CreateSecretRequest): Promise<Secret> {
    const response = await this.client.post<Secret>('/secrets', request);
    return response.data;
  }

  /**
   * Update secret value
   */
  async updateSecret(secretId: string, request: UpdateSecretRequest): Promise<void> {
    await this.client.put(`/secrets/${secretId}`, request);
  }

  /**
   * Update rotation period
   */
  async updateRotationPeriod(
    secretId: string,
    request: UpdateRotationPeriodRequest
  ): Promise<void> {
    await this.client.put(`/secrets/${secretId}/rotation`, request);
  }

  /**
   * Search secrets
   */
  async searchSecrets(query: string): Promise<Secret[]> {
    const response = await this.client.get<ListSecretsResponse>(
      `/secrets/search?q=${encodeURIComponent(query)}`
    );
    return response.data.secrets;
  }

  /**
   * Get audit log for a secret
   */
  async getAuditLog(secretId: string): Promise<AuditLogResponse> {
    const response = await this.client.get<AuditLogResponse>(`/secrets/${secretId}/audit`);
    return response.data;
  }

  /**
   * Get access report (admin only)
   */
  async getAccessReport(): Promise<{ entries: any[]; total: number }> {
    const response = await this.client.get('/reports/access');
    return response.data;
  }

  /**
   * Get AWS Console changes report (admin only)
   */
  async getConsoleChangesReport(): Promise<{ entries: any[]; total: number }> {
    const response = await this.client.get('/reports/console-changes');
    return response.data;
  }

  /**
   * Get distinct applications
   */
  async getApplications(): Promise<{ applications: string[] }> {
    const response = await this.client.get('/secrets/applications');
    return response.data;
  }

  /**
   * Get distinct environments
   */
  async getEnvironments(): Promise<{ environments: string[] }> {
    const response = await this.client.get('/secrets/environments');
    return response.data;
  }
}

export const apiClient = new ApiClient();

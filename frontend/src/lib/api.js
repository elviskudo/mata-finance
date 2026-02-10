import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  validateSession: () => api.get('/auth/validate'),
};

// Dashboard API
export const dashboardAPI = {
  // Allow optional query params (e.g., scope, userId) to enforce guards on backend
  getSummary: (params) => api.get('/dashboard/summary', { params }),
  getActivity: (params) => api.get('/dashboard/activity', { params }),
  getCompanyData: () => api.get('/dashboard/company-data'),
};

// Transaction API
export const transactionAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data), // Legacy

  // Entry Hub Flow
  getEntryHub: () => api.get('/transactions/entry-hub'),
  init: (data) => api.post('/transactions/init', data),
  updateHeader: (id, data) => api.put(`/transactions/${id}/header`, data),
  addItems: (id, items) => api.post(`/transactions/${id}/items`, { items }),
  uploadDocument: (id, formData) => api.post(`/transactions/${id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getPreCheck: (id) => api.get(`/transactions/${id}/pre-check`),
  submit: (id, data) => api.post(`/transactions/${id}/submit`, data),
  saveDraft: (id) => api.put(`/transactions/${id}/draft`),

  // Revision APIs
  getRevisionDetails: (id) => api.get(`/transactions/${id}/revision-details`),
  getRevisionStatus: (id) => api.get(`/transactions/${id}/revision-status`),
  saveRevision: (id, changes) => api.put(`/transactions/${id}/save-revision`, changes),
  resubmit: (id, data) => api.post(`/transactions/${id}/resubmit`, data),

  // Timeline API
  getTimeline: (id) => api.get(`/transactions/${id}/timeline`),

  // Replacement Flow
  getPendingReplacements: () => api.get('/transactions/pending-replacements'),
  createReplacement: (id) => api.post(`/transactions/${id}/create-replacement`),
};

// Exception API
export const exceptionAPI = {
  getAll: () => api.get('/exceptions'),
  getById: (caseId) => api.get(`/exceptions/${caseId}`),
  patch: (caseId, patch) => api.put(`/exceptions/${caseId}/patch`, { patch }),
  recheck: (caseId) => api.post(`/exceptions/${caseId}/recheck`),
};

// Alert API
export const alertAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getCount: () => api.get('/alerts/count'),
  markAsRead: (id) => api.post(`/alerts/${id}/read`),
  markAllAsRead: () => api.post('/alerts/read-all'),
};

// Help API
export const helpAPI = {
  getSOP: (contextType, contextCode) => api.get('/help/sop', { params: { contextType, contextCode } }),
};

// Approval API
export const approvalAPI = {
  getHomeContext: () => api.get('/approval/home-context'),
  getStats: () => api.get('/approval/stats'),
  getQueue: (params) => api.get('/approval/queue', { params }),
  getTransaction: (id) => api.get(`/approval/transactions/${id}`),
  approve: (id, notes) => api.post(`/approval/transactions/${id}/approve`, { notes }),
  reject: (id, data) => api.post(`/approval/transactions/${id}/reject`, typeof data === 'string' ? { reason: data } : data),
  clarify: (id, reason) => api.post(`/approval/transactions/${id}/clarify`, { reason }),
  getEmergencyList: () => api.get('/approval/emergency-list'),
  getSystemNotices: () => api.get('/approval/notices'),
  getMyDecisions: () => api.get('/approval/my-decisions'),
};

export default api;



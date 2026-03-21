const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface FetchOptions extends RequestInit {
  token?: string | null;
}

async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { headers, ...rest });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const authApi = {
  register: (data: { login: string; password: string; display_name: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { login: string; password: string }) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  studentLogin: (data: { login: string; code: string }) =>
    apiFetch('/auth/student-login', { method: 'POST', body: JSON.stringify(data) }),
  me: (token: string) =>
    apiFetch('/auth/me', { token }),
};

// Classrooms
export const classroomsApi = {
  list: (token: string) =>
    apiFetch('/classrooms', { token }),
  create: (token: string, data: { name: string; grade: number }) =>
    apiFetch('/classrooms', { method: 'POST', body: JSON.stringify(data), token }),
  get: (token: string, id: number) =>
    apiFetch(`/classrooms/${id}`, { token }),
  delete: (token: string, id: number) =>
    apiFetch(`/classrooms/${id}`, { method: 'DELETE', token }),
  addStudent: (token: string, classroomId: number, data: { display_name: string }) =>
    apiFetch(`/classrooms/${classroomId}/students`, { method: 'POST', body: JSON.stringify(data), token }),
  addStudentsBatch: (token: string, classroomId: number, names: string[]) =>
    apiFetch(`/classrooms/${classroomId}/students/batch`, { method: 'POST', body: JSON.stringify({ names }), token }),
  removeStudent: (token: string, classroomId: number, studentId: number) =>
    apiFetch(`/classrooms/${classroomId}/students/${studentId}`, { method: 'DELETE', token }),
};

// Tests
export const testsApi = {
  list: (grade?: number) =>
    apiFetch(`/tests${grade ? `?grade=${grade}` : ''}`),
  get: (id: number) =>
    apiFetch(`/tests/${id}`),
  my: (token: string) =>
    apiFetch('/tests/my', { token }),
  create: (token: string, data: Record<string, unknown>) =>
    apiFetch('/tests', { method: 'POST', body: JSON.stringify(data), token }),
  update: (token: string, id: number, data: Record<string, unknown>) =>
    apiFetch(`/tests/${id}`, { method: 'PUT', body: JSON.stringify(data), token }),
  delete: (token: string, id: number) =>
    apiFetch(`/tests/${id}`, { method: 'DELETE', token }),
  duplicate: (token: string, id: number) =>
    apiFetch(`/tests/${id}/duplicate`, { method: 'POST', token }),
  addQuestion: (token: string, testId: number, data: Record<string, unknown>) =>
    apiFetch(`/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify(data), token }),
  updateQuestion: (token: string, testId: number, questionId: number, data: Record<string, unknown>) =>
    apiFetch(`/tests/${testId}/questions/${questionId}`, { method: 'PUT', body: JSON.stringify(data), token }),
  deleteQuestion: (token: string, testId: number, questionId: number) =>
    apiFetch(`/tests/${testId}/questions/${questionId}`, { method: 'DELETE', token }),
  importHtml: async (token: string, formData: FormData) => {
    const res = await fetch(`${API_BASE}/tests/import-html`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

// Assignments
export const assignmentsApi = {
  create: (token: string, data: Record<string, unknown>) =>
    apiFetch('/assignments', { method: 'POST', body: JSON.stringify(data), token }),
  getByLink: (shareLink: string) =>
    apiFetch(`/assignments/by-link/${shareLink}`),
  listForClassroom: (token: string, classroomId: number) =>
    apiFetch(`/assignments/classroom/${classroomId}`, { token }),
};

// Attempts
export const attemptsApi = {
  start: (data: { test_id: number; assignment_id?: number; anonymous_name?: string }, token?: string | null) =>
    apiFetch('/attempts/start', { method: 'POST', body: JSON.stringify(data), token: token || undefined }),
  submitAnswer: (attemptId: number, data: { question_id: number; answer: unknown }, token?: string | null) =>
    apiFetch(`/attempts/${attemptId}/answer`, { method: 'POST', body: JSON.stringify(data), token: token || undefined }),
  finish: (attemptId: number, token?: string | null) =>
    apiFetch(`/attempts/${attemptId}/finish`, { method: 'POST', token: token || undefined }),
  get: (attemptId: number, token?: string | null) =>
    apiFetch(`/attempts/${attemptId}`, { token: token || undefined }),
  journal: (token: string, classroomId: number) =>
    apiFetch(`/attempts/journal/${classroomId}`, { token }),
  stats: (token: string, classroomId: number, testId: number) =>
    apiFetch(`/attempts/test-stats/${classroomId}/${testId}`, { token }),
};

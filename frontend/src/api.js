import { getToken, removeToken } from './auth';

const BASE = '/api';

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = '/entrar';
    return;
  }
  if (res.status === 204 || res.status === 205) return null;
  if (options.method === 'DELETE') {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.detail || 'Erro na requisição');
      err.status = res.status;
      throw err;
    }
    return null;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = typeof body.detail === 'string'
      ? body.detail
      : Array.isArray(body.detail)
        ? body.detail.map(d => d.msg).join('; ')
        : 'Erro na requisição';
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Professors
export const getProfessors = () => request('/professors/');

// User profile
export const updateMyProfile   = (data) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
export const updateUserProfile = (userId, data) => request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const getProfileBySlug = (slug) => request(`/profiles/by-slug/${slug}`);

// Researchers
export const getResearchers = (institutionId, ativo) => {
  const params = new URLSearchParams();
  if (institutionId) params.set('institution_id', institutionId);
  if (ativo !== undefined) params.set('ativo', ativo);
  const qs = params.toString();
  return request(`/researchers/${qs ? `?${qs}` : ''}`);
};
export const createResearcher = (data) => request('/researchers/', { method: 'POST', body: JSON.stringify(data) });
export const updateResearcher = (id, data) => request(`/researchers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteResearcher = (id) => request(`/researchers/${id}`, { method: 'DELETE' });

// Relationships
export const getRelationships = () => request('/relationships/');
export const createRelationship = (data) => request('/relationships/', { method: 'POST', body: JSON.stringify(data) });
export const updateRelationship = (id, data) => request(`/relationships/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRelationship = (id) => request(`/relationships/${id}`, { method: 'DELETE' });

// Graph
export const getGraph = (institutionId) =>
  request(`/graph/${institutionId ? `?institution_id=${institutionId}` : ''}`);
export const updateLayout = (positions) => request('/graph/layout', { method: 'PUT', body: JSON.stringify({ positions }) });

// Notes
export const getNotes = (userId) =>
  request(`/users/${userId}/notes`);
export const deleteNote = (noteId) => request(`/notes/${noteId}`, { method: 'DELETE' });

export async function updateNote(noteId, text) {
  const form = new FormData();
  form.append('text', text);
  const token = getToken();
  const res = await fetch(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

export async function createNote(userId, text, file) {
  const form = new FormData();
  form.append('text', text);
  if (file) form.append('file', file);
  const token = getToken();
  const res = await fetch(`/api/users/${userId}/notes`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

// Researcher
export const getResearcher = (id) => request(`/researchers/${id}`);
export const getResearcherUser = (researcherId) => request(`/researchers/${researcherId}/user`);

// Reminders
export const getReminders = (institutionId) =>
  request(`/reminders/${institutionId ? `?institution_id=${institutionId}` : ''}`);
export const createReminder = (data, institutionId) =>
  request('/reminders/', { method: 'POST', body: JSON.stringify({ ...data, institution_id: institutionId || null }) });
export const updateReminder = (id, data) => request(`/reminders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export async function deleteReminder(id) {
  const token = getToken();
  const res = await fetch(`${BASE}/reminders/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = '/entrar';
    return;
  }
  if (!res.ok) {
    let msg = 'Não foi possível remover';
    try {
      const body = await res.json();
      if (body?.detail) msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

// Tips
export const getTips = (institutionId) =>
  request(`/tips/${institutionId ? `?institution_id=${institutionId}` : ''}`);
export const getTip = (id) => request(`/tips/${id}`);
export const createTip = (data, institutionId) =>
  request('/tips/', { method: 'POST', body: JSON.stringify({ ...data, institution_id: institutionId || null }) });
export const updateTip = (id, data) => request(`/tips/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTip = (id) => request(`/tips/${id}`, { method: 'DELETE' });
export const toggleTipVote = (entryId) => request(`/tips/${entryId}/vote`, { method: 'POST' });
export const addTipComment = (entryId, text) => request(`/tips/${entryId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
export const deleteTipComment = (commentId) => request(`/tips/comments/${commentId}`, { method: 'DELETE' });

// Deadlines
export const getDeadlines = (institutionId) =>
  request(`/deadlines/${institutionId ? `?institution_id=${institutionId}` : ''}`);
export const createDeadline = (data) =>
  request('/deadlines/', { method: 'POST', body: JSON.stringify(data) });
export const deleteDeadline = (id) =>
  request(`/deadlines/${id}`, { method: 'DELETE' });
export const getDeadlineInterests = (institutionId) =>
  request(`/deadlines/interests${institutionId ? `?institution_id=${institutionId}` : ''}`);
export const toggleDeadlineInterest = (deadlineId) =>
  request(`/deadlines/${deadlineId}/interest`, { method: 'POST' });
export const extractDeadlineFromUrl = (url) =>
  request('/deadlines/extract-url', { method: 'POST', body: JSON.stringify({ url }) });

// Upload
export async function uploadPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  const token = getToken();
  const res = await fetch(`${BASE}/upload/photo`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  const token = getToken();
  const res = await fetch(`${BASE}/upload/image`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  return data.url;
}


// Institutions
export const getInstitutions = () => request('/institutions/');
export const createInstitution = (email) => request('/institutions/', { method: 'POST', body: JSON.stringify({ email }) });
export const getMyEmails = () => request('/institutions/my-emails');
export const addMyEmail = (email) => request('/institutions/my-emails', { method: 'POST', body: JSON.stringify({ email }) });
export const removeMyEmail = (piId) => request(`/institutions/my-emails/${piId}`, { method: 'DELETE' });

// Groups
export const getGroups = () => request('/groups/');
export const createGroup = (name, institution_id) => request('/groups/', { method: 'POST', body: JSON.stringify({ name, institution_id }) });
export const updateGroup = (id, data) => request(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// --- Admin ---
export const getAdminStats = () => request('/admin/stats');
export const getAdminUsers = () => request('/admin/users');
export const updateUserRole = (id, role) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) });
export const deleteUser = (id) => request(`/admin/users/${id}`, { method: 'DELETE' });
export const deletePendingResearcher = (id) => request(`/admin/researchers/${id}`, { method: 'DELETE' });
export const bulkDeleteUsers = (user_ids, researcher_ids) => request('/admin/bulk-delete', { method: 'POST', body: JSON.stringify({ user_ids, researcher_ids }) });
export const inviteProfessor = (data) => request('/admin/invite-professor', { method: 'POST', body: JSON.stringify(data) });

// Activity
export const getMyResearchersActivity = (limit = 100) => request(`/activity/my-researchers?limit=${limit}`);
export const getUserActivity = (userId, limit = 50) => request(`/activity/user/${userId}?limit=${limit}`);
export const getUserStats = (userId) => request(`/activity/user/${userId}/stats`);

// Milestones
export const getMilestones      = (userId) => request(`/users/${userId}/milestones/`);
export const createMilestone    = (userId, data) => request(`/users/${userId}/milestones/`, { method: 'POST', body: JSON.stringify(data) });
export const updateMilestone    = (userId, milestoneId, data) => request(`/users/${userId}/milestones/${milestoneId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMilestone    = (userId, milestoneId) => request(`/users/${userId}/milestones/${milestoneId}`, { method: 'DELETE' });

// Readings
export const getReadings        = (userId) => request(`/users/${userId}/readings/`);
export const createReading      = (userId, url) => request(`/users/${userId}/readings/`, { method: 'POST', body: JSON.stringify({ url }) });
export const updateReadingStatus = (userId, readingId, status) => request(`/users/${userId}/readings/${readingId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const deleteReading      = (userId, readingId) => request(`/users/${userId}/readings/${readingId}`, { method: 'DELETE' });
export const summarizeReading   = (userId, readingId) => request(`/users/${userId}/readings/${readingId}/summarize`, { method: 'POST' });

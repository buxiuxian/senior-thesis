const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rshub.zju.edu.cn/backend-rsagent'
  : 'http://localhost:8000';

const RSHUB_API_BASE = 'https://rshub.zju.edu.cn';

export const API_ENDPOINTS = {
  // Agent endpoints (Phase 2)
  AGENT_CHAT: `${API_BASE_URL}/api/agent/chat`,
  AGENT_CHAT_UPLOAD: `${API_BASE_URL}/api/agent/chat/upload`,
  
  // Task management endpoints
  SUBMIT_TASK: `${API_BASE_URL}/api/tasks/submit`,
  CHECK_TASK: `${API_BASE_URL}/api/tasks/check`,
  DOWNLOAD_TASK: `${API_BASE_URL}/api/tasks/download`,
  LIST_TASK_FILES: `${API_BASE_URL}/api/tasks/list-files`,
  DOWNLOAD_SELECTED_FILES: `${API_BASE_URL}/api/tasks/download-files`,
  
  // Credit endpoint
  GET_CREDITS: `${API_BASE_URL}/api/credits`,
  
  // RSHub direct endpoints (user management)
  USER_PROFILE: `${RSHUB_API_BASE}/users/profile`,
  USER_LOGIN: `${RSHUB_API_BASE}/users/login`,
  DELETE_TASK: `${RSHUB_API_BASE}/users/api/delete-task`,
  DELETE_PROJECT: `${RSHUB_API_BASE}/users/api/delete-project`,
  
  // WebSocket (future use)
  WS_PROGRESS: (sessionId) => 
    `${API_BASE_URL.replace('http', 'ws')}/ws/progress/${sessionId}`,
};

export const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});

export default API_ENDPOINTS;


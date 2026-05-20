import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { getAuthToken, clearAuthTokens } from './auth';

const apiClient = axios.create({
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    const isTaskCheck = config.url?.includes('/api/tasks/check');
    
    if (!isTaskCheck) {
      const token = getAuthToken();
      
      if (!token) {
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        return Promise.reject(new Error('No valid token'));
      }
      
      if (!config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthTokens();
      window.dispatchEvent(new CustomEvent('auth:invalid'));
      window.location.href = '/Login';
    }
    return Promise.reject(error);
  }
);

export const taskAPI = {
  async fetchUserTasks(token) {
    const response = await axios.post(API_ENDPOINTS.USER_PROFILE, {
      tokenTmp: token
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = response.data;
    if (data.result && data.projectlist) {
      const tasks = [];
      data.projectlist.forEach(project => {
        if (project.Tasks && project.Tasks.length > 0) {
          project.Tasks.forEach(task => {
            tasks.push({
              projectName: project.ProjectName,
              taskName: task.TaskName,
              status: task.Status,
              startDate: task.StartDate,
              endDate: task.EndDate,
            });
          });
        }
      });
      return tasks;
    }
    return [];
  },

  async submitTask(taskData) {
    if (!taskData?.token) {
      throw new Error('Missing token for submitTask');
    }
    const response = await apiClient.post(API_ENDPOINTS.SUBMIT_TASK, taskData);
    return response.data;
  },

  async checkTaskStatus(token, projectName, taskName) {
    const response = await apiClient.get(
      `${API_ENDPOINTS.CHECK_TASK}?token=${encodeURIComponent(token)}&project=${encodeURIComponent(projectName)}&task=${encodeURIComponent(taskName)}`
    );

    const data = response.data;
    // Normalize legacy/non-standard responses to the shape expected by the UI
    if (typeof data?.success === 'boolean') {
      return data;
    }

    const statusText = data?.task_status || data?.status || data?.result || 'unknown';
    const statusLower = statusText.toString().toLowerCase();
    const isCompleted = statusLower.includes('completed');

    return {
      success: true,
      status: statusText,
      completed: isCompleted,
      project: data?.project || data?.project_name || projectName,
      task: data?.task || data?.task_name || taskName,
    };
  },

  async getDownloadUrl(projectName, taskName) {
    const response = await apiClient.get(
      `${API_ENDPOINTS.DOWNLOAD_TASK}?project=${encodeURIComponent(projectName)}&task=${encodeURIComponent(taskName)}`
    );
    return response.data;
  },

  async deleteTask(projectName, taskName, token) {
    const response = await axios.post(API_ENDPOINTS.DELETE_TASK, {
      project_name: projectName,
      task_name: taskName,
      token: token
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  async listTaskFiles(projectName, taskName) {
    const response = await apiClient.get(
      `${API_ENDPOINTS.LIST_TASK_FILES}?project=${encodeURIComponent(projectName)}&task=${encodeURIComponent(taskName)}`
    );
    return response.data;
  },

  async downloadSelectedFiles(projectName, taskName, filenames) {
    const filenamesParam = Array.isArray(filenames) ? filenames.join(',') : filenames;
    const url = `${API_ENDPOINTS.DOWNLOAD_SELECTED_FILES}?project=${encodeURIComponent(projectName)}&task=${encodeURIComponent(taskName)}&filenames=${encodeURIComponent(filenamesParam)}`;
    
    const response = await apiClient.post(url, null, {
      responseType: 'blob'
    });
    
    const contentDisposition = response.headers['content-disposition'];
    let filename = `${taskName}_download`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    const blob = new Blob([response.data], { 
      type: response.headers['content-type'] || 'application/octet-stream' 
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    
    return { success: true, filename };
  },
};

export const creditAPI = {
  async getCredits(token) {
    const response = await apiClient.get(API_ENDPOINTS.GET_CREDITS, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  },
};

export default apiClient;


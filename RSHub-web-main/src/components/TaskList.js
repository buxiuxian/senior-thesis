import React, { useEffect, useState } from 'react';
import { Badge, Button, Group, Text, Stack, Loader, Center, Select, Menu, Checkbox } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import useTaskStore from '../stores/taskStore';
import { taskAPI } from '../utils/apiClient';
import { API_ENDPOINTS } from '../config/api';
import { useUserAuth } from './UserAuthContext';
import styles from './TaskList.module.css';
import { getAuthToken } from '../utils/auth';

const STATUS_COLORS = {
  'completed': 'green',
  'running': 'blue',
  'in progress': 'blue',
  'in queue': 'yellow',
  'queued': 'yellow',
  'failed': 'red',
};

const STATUS_LABELS = {
  'completed': 'Completed',
  'running': 'Running',
  'in progress': 'Running',
  'in queue': 'Queued',
  'queued': 'Queued',
  'failed': 'Failed',
};

export default function TaskList() {
  const { token: tokenTmp } = useUserAuth();
  const { tasks, loading, error, filterStatus, setTasks, setLoading, setError, setFilterStatus, deleteTask: deleteTaskFromStore, triggerRefresh } = useTaskStore();
  const [localLoading, setLocalLoading] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState({});
  const [availableFiles, setAvailableFiles] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});
  const [loadingFiles, setLoadingFiles] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  const fetchTasks = async () => {
    if (!tokenTmp) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedTasks = await taskAPI.fetchUserTasks(tokenTmp);
      setTasks(fetchedTasks);
      triggerRefresh();
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
      notifications.show({
        title: 'Error',
        message: 'Failed to load task list',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [tokenTmp]);

  const handleDelete = async (projectName, taskName) => {
    if (!confirm(`Delete task "${taskName}"?`)) return;
    
    const token = getAuthToken();
    if (!token) {
      notifications.show({
        title: 'Error',
        message: 'Please login again',
        color: 'red',
      });
      window.dispatchEvent(new CustomEvent('auth:invalid'));
      return;
    }
    
    setLocalLoading(true);
    try {
      const result = await taskAPI.deleteTask(projectName, taskName, token);
      console.log('Delete API response:', result);
      if (result && result.result === true) {
        deleteTaskFromStore(projectName, taskName);
        notifications.show({
          title: 'Success',
          message: 'Task deleted successfully',
          color: 'green',
        });
      } else {
        throw new Error(result?.error_message || result?.error || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to delete task',
        color: 'red',
      });
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDownloadMenuOpen = async (task) => {
    const taskKey = `${task.projectName}/${task.taskName}`;
    
    if (availableFiles[taskKey]) {
      setFileMenuOpen({ ...fileMenuOpen, [taskKey]: true });
      return;
    }
    
    setLoadingFiles({ ...loadingFiles, [taskKey]: true });
    
    try {
      const result = await taskAPI.listTaskFiles(task.projectName, task.taskName);
      
      if (result.success && result.files && result.files.length > 0) {
        setAvailableFiles({ ...availableFiles, [taskKey]: result.files });
        setSelectedFiles({ ...selectedFiles, [taskKey]: [] });
        setFileMenuOpen({ ...fileMenuOpen, [taskKey]: true });
      } else {
        notifications.show({
          title: 'No Files Available',
          message: 'No output files found for this task',
          color: 'orange',
        });
      }
    } catch (error) {
      console.error('Failed to list files:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load file list',
        color: 'red',
      });
    } finally {
      setLoadingFiles({ ...loadingFiles, [taskKey]: false });
    }
  };
      
  const handleFileSelect = (taskKey, filename) => {
    const currentSelected = selectedFiles[taskKey] || [];
    const isSelected = currentSelected.includes(filename);
    
    const newSelected = isSelected
      ? currentSelected.filter(f => f !== filename)
      : [...currentSelected, filename];
    
    setSelectedFiles({ ...selectedFiles, [taskKey]: newSelected });
  };

  const handleSelectAll = (taskKey) => {
    const files = availableFiles[taskKey] || [];
    const currentSelected = selectedFiles[taskKey] || [];
    
    if (currentSelected.length === files.length) {
      setSelectedFiles({ ...selectedFiles, [taskKey]: [] });
    } else {
      setSelectedFiles({ ...selectedFiles, [taskKey]: files });
    }
  };

  const handleDownloadSelected = async (task) => {
    const taskKey = `${task.projectName}/${task.taskName}`;
    const filesToDownload = selectedFiles[taskKey] || [];
    
    if (filesToDownload.length === 0) {
      notifications.show({
        title: 'No Files Selected',
        message: 'Please select at least one file to download',
        color: 'orange',
      });
      return;
    }
    
    try {
      await taskAPI.downloadSelectedFiles(task.projectName, task.taskName, filesToDownload);
      
      notifications.show({
        title: 'Download Started',
        message: `Downloading ${filesToDownload.length} file(s)`,
        color: 'green',
      });
      
      setFileMenuOpen({ ...fileMenuOpen, [taskKey]: false });
    } catch (error) {
      console.error('Failed to download files:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to download selected files',
        color: 'red',
      });
    }
  };

  const handleCopy = (projectName, taskName) => {
    const copyText = `${projectName}/${taskName}`;
    navigator.clipboard.writeText(copyText).then(() => {
      notifications.show({
        title: 'Copied',
        message: `Task identifier "${copyText}" copied to clipboard`,
        color: 'gray',
      });
    }).catch(err => {
      console.error('Failed to copy:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to copy task identifier',
        color: 'red',
      });
    });
  };

  const handleCheckStatus = async (projectName, taskName) => {
    const token = getAuthToken();
    if (!token) {
      notifications.show({
        title: 'Error',
        message: 'Please login again',
        color: 'red',
      });
      window.dispatchEvent(new CustomEvent('auth:invalid'));
      return;
    }
    
    try {
      const data = await taskAPI.checkTaskStatus(token, projectName, taskName);
      if (data.success) {
        notifications.show({
          title: 'Task Status',
          message: `Status: ${data.status}${data.completed ? ' (Completed)' : ''}`,
          color: data.completed ? 'green' : 'blue',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: data.error?.message || 'Failed to check status',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Failed to check status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to check task status',
        color: 'red',
      });
    }
  };

  const getFilteredTasks = () => {
    let filteredList = filterStatus === 'all' ? tasks : tasks.filter(task => {
      const status = task.status?.toLowerCase() || '';
      switch (filterStatus) {
        case 'queued':
          return status === 'in queue' || status === 'queued';
        case 'running':
          return status === 'running' || status === 'in progress';
        case 'completed':
          return status === 'completed';
        case 'failed':
          return status === 'failed';
        default:
          return true;
      }
    });
    
    return [...filteredList].reverse();
  };

  const groupTasksByProject = (tasks) => {
    const grouped = {};
    tasks.forEach(task => {
      const projectName = task.projectName;
      if (!grouped[projectName]) {
        grouped[projectName] = [];
      }
      grouped[projectName].push(task);
    });
    return grouped;
  };

  const filteredTasks = getFilteredTasks();
  const groupedTasks = groupTasksByProject(filteredTasks);

  useEffect(() => {
    const initialExpanded = {};
    Object.keys(groupedTasks).forEach(projectName => {
      initialExpanded[projectName] = true;
    });
    setExpandedProjects(initialExpanded);
  }, [tasks, filterStatus]);

  const toggleProject = (projectName) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  if (loading && tasks.length === 0) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="yellow" />
          <Text c="dimmed">Loading tasks...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <div className={styles.taskListWrapper}>
      <Group justify="space-between" mb="md" className={styles.controlBar}>
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          data={[
            { value: 'all', label: 'All Tasks' },
            { value: 'queued', label: 'Queued' },
            { value: 'running', label: 'Running' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
          ]}
          w={150}
        />
        
        <Button 
          onClick={fetchTasks}
          loading={loading}
          variant="light"
          color="yellow"
        >
          Refresh
        </Button>
      </Group>

      {error && (
        <Text c="red" size="sm" mb="md">
          {error}
        </Text>
      )}

      <div className={styles.cardsContainer}>
        {filteredTasks.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed">No tasks found</Text>
          </Center>
        ) : (
          <Stack gap="lg">
            {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
              <div key={projectName} className={styles.projectGroup}>
                <div 
                  className={styles.projectHeader}
                  onClick={() => toggleProject(projectName)}
                >
                  <div className={styles.projectHeaderLeft}>
                    <Text className={styles.projectHeaderIcon}>
                      {expandedProjects[projectName] ? '▼' : '▶'}
                    </Text>
                    <Text fw={700} size="md" className={styles.projectHeaderName}>
                      {projectName}
                    </Text>
                    <Badge size="sm" variant="light" color="gray">
                      {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
                    </Badge>
                  </div>
                </div>
                
                {expandedProjects[projectName] && (
                  <Stack gap="md" className={styles.projectTasksList}>
                    {projectTasks.map((task, index) => (
              <div 
                key={`${task.projectName}-${task.taskName}-${index}`}
                className={styles.taskCard}
              >
                <div className={styles.taskCardLayout}>
                  <div className={styles.taskLeftSection}>
                    <Text fw={600} size="sm" className={styles.taskName}>
                      {task.taskName}
                    </Text>
                    <Text size="xs" c="dimmed" className={styles.projectName}>
                      {task.projectName}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      {task.startDate}
                    </Text>
                  </div>
                  
                  <div className={styles.taskRightSection}>
                    <Badge 
                      color={STATUS_COLORS[task.status?.toLowerCase()] || 'gray'}
                      variant="filled"
                      size="sm"
                      className={styles.statusBadge}
                    >
                      {STATUS_LABELS[task.status?.toLowerCase()] || task.status}
                    </Badge>
                    
                    <Group gap="xs" className={styles.actionButtons}>
                      {task.status?.toLowerCase() === 'completed' && (
                        <Menu
                          opened={fileMenuOpen[`${task.projectName}/${task.taskName}`]}
                          onChange={(opened) => {
                            const taskKey = `${task.projectName}/${task.taskName}`;
                            if (!opened) {
                              setFileMenuOpen({ ...fileMenuOpen, [taskKey]: false });
                            }
                          }}
                          position="bottom-end"
                          shadow="md"
                          width={300}
                          closeOnItemClick={false}
                        >
                          <Menu.Target>
                        <Button 
                          variant="subtle" 
                          color="green"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                                handleDownloadMenuOpen(task);
                          }}
                              loading={loadingFiles[`${task.projectName}/${task.taskName}`]}
                        >
                              Download ▼
                        </Button>
                          </Menu.Target>
                          
                          <Menu.Dropdown>
                            {(() => {
                              const taskKey = `${task.projectName}/${task.taskName}`;
                              const files = availableFiles[taskKey] || [];
                              const selected = selectedFiles[taskKey] || [];
                              
                              return (
                                <>
                                  <Menu.Label>Select Files to Download</Menu.Label>
                                  
                                  {files.map((filename) => (
                                    <Menu.Item
                                      key={filename}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFileSelect(taskKey, filename);
                                      }}
                                      leftSection={
                                        <Checkbox
                                          checked={selected.includes(filename)}
                                          onChange={() => {}}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      }
                                    >
                                      <Text size="sm" style={{ userSelect: 'none' }}>
                                        {filename}
                                      </Text>
                                    </Menu.Item>
                                  ))}
                                  
                                  <Menu.Divider />
                                  
                                  <Menu.Item
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAll(taskKey);
                                    }}
                                    leftSection={
                                      <Checkbox
                                        checked={selected.length === files.length && files.length > 0}
                                        indeterminate={selected.length > 0 && selected.length < files.length}
                                        onChange={() => {}}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    }
                                  >
                                    <Text size="sm" fw={600} style={{ userSelect: 'none' }}>
                                      Select All
                                    </Text>
                                  </Menu.Item>
                                  
                                  <Menu.Divider />
                                  
                                  <Menu.Item
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadSelected(task);
                                    }}
                                    color="green"
                                    disabled={selected.length === 0}
                                  >
                                    <Text size="sm" fw={600} style={{ userSelect: 'none' }}>
                                      Download Selected ({selected.length})
                                    </Text>
                                  </Menu.Item>
                                </>
                              );
                            })()}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                      <Button 
                        variant="subtle" 
                        color="gray"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(task.projectName, task.taskName);
                        }}
                      >
                        Copy
                      </Button>
                      <Button 
                        variant="subtle" 
                        color="blue"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckStatus(task.projectName, task.taskName);
                        }}
                      >
                        Check
                      </Button>
                      <Button 
                        variant="subtle" 
                        color="red"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(task.projectName, task.taskName);
                        }}
                        loading={localLoading}
                      >
                        Delete
                      </Button>
                    </Group>
                  </div>
                </div>
              </div>
                    ))}
                  </Stack>
                )}
              </div>
            ))}
          </Stack>
        )}
      </div>
    </div>
  );
}


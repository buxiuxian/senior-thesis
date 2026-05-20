import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useTaskStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      loading: false,
      error: null,
      filterStatus: 'all',
      refreshTrigger: 0,
      
      setTasks: (tasks) => set({ tasks }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  setFilterStatus: (status) => set({ filterStatus: status }),
  
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
  
  addTask: (task) => set((state) => ({
    tasks: [task, ...state.tasks]
  })),
  
  updateTask: (projectName, taskName, updates) => set((state) => ({
    tasks: state.tasks.map(task => 
      task.projectName === projectName && task.taskName === taskName
        ? { ...task, ...updates }
        : task
    )
  })),
  
  deleteTask: (projectName, taskName) => set((state) => ({
    tasks: state.tasks.filter(task => 
      !(task.projectName === projectName && task.taskName === taskName)
    )
  })),
  
  getFilteredTasks: () => {
    const { tasks, filterStatus } = get();
    if (filterStatus === 'all') return tasks;
    return tasks.filter(task => {
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
  },
  
  clearTasks: () => set({ tasks: [], error: null }),
}),
    {
      name: 'rshub-task-storage',
      partialize: (state) => ({ 
        tasks: state.tasks.map(task => {
          const { taskData, ...rest } = task;
          return rest;
        })
      }),
    }
  )
);

export default useTaskStore;


import { useState, useEffect, useCallback } from 'react';
import { ValidationTask } from '../types/database';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useValidationTasks = () => {
  const [tasks, setTasks] = useState<ValidationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('validation_tasks_with_ldap')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load validation tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Real-time subscription handlers
  const handleInsert = useCallback((payload: any) => {
    console.log('New task inserted:', payload.new);
    setTasks(current => [payload.new, ...current]);
  }, []);

  const handleUpdate = useCallback((payload: any) => {
    console.log('Task updated:', payload.new);
    setTasks(current =>
      current.map(task =>
        task.id === payload.new.id ? { ...task, ...payload.new } : task
      )
    );
  }, []);

  const handleDelete = useCallback((payload: any) => {
    console.log('Task deleted:', payload.old);
    setTasks(current =>
      current.filter(task => task.id !== payload.old.id)
    );
  }, []);

  // Set up real-time subscription
  useRealtimeSubscription({
    table: 'validation_tasks',
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete
  });

  // Utility function to update a specific task
  const updateTask = useCallback((taskId: string, updates: Partial<ValidationTask>) => {
    setTasks(current =>
      current.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  }, []);

  // Utility function to add a new task
  const addTask = useCallback((newTask: ValidationTask) => {
    setTasks(current => [newTask, ...current]);
  }, []);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    updateTask,
    addTask
  };
};
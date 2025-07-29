import { useState, useEffect, useCallback } from 'react';
import { ValidationTask } from '../types/database';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useValidationTask = (taskId: string | undefined) => {
  const [task, setTask] = useState<ValidationTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('validation_tasks_with_ldap')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      setTask(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching task:', err);
      setError('Failed to load task details');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Real-time subscription handlers
  const handleUpdate = useCallback((payload: any) => {
    if (payload.new.id === taskId) {
      console.log('Task updated:', payload.new);
      setTask(current => current ? { ...current, ...payload.new } : payload.new);
    }
  }, [taskId]);

  // Set up real-time subscription for this specific task
  useRealtimeSubscription({
    table: 'validation_tasks',
    filter: `id=eq.${taskId}`,
    onUpdate: handleUpdate
  });

  // Utility function to update the task optimistically
  const updateTask = useCallback((updates: Partial<ValidationTask>) => {
    setTask(current => current ? { ...current, ...updates } : null);
  }, []);

  return {
    task,
    loading,
    error,
    fetchTask,
    updateTask
  };
};
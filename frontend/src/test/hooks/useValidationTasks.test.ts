import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useValidationTasks } from '../../hooks/useValidationTasks';
import { mockSupabaseClient } from '../mocks/supabase';

// Mock the realtime subscription hook
vi.mock('../../hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: vi.fn()
}));

describe('useValidationTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tasks on mount', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        status: 'PENDING_VALIDATION',
        git_branch: 'feature/test',
        created_at: '2023-01-01T10:00:00Z'
      }
    ];

    mockSupabaseClient.from().select().order().mockResolvedValue({
      data: mockTasks,
      error: null
    });

    const { result } = renderHook(() => useValidationTasks());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tasks).toEqual(mockTasks);
    expect(result.current.error).toBe(null);
  });

  it('sets error when fetch fails', async () => {
    const mockError = new Error('Fetch failed');
    mockSupabaseClient.from().select().order().mockRejectedValue(mockError);

    const { result } = renderHook(() => useValidationTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load validation tasks');
    expect(result.current.tasks).toEqual([]);
  });

  it('handles empty data gracefully', async () => {
    mockSupabaseClient.from().select().order().mockResolvedValue({
      data: null,
      error: null
    });

    const { result } = renderHook(() => useValidationTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('calls correct supabase methods', async () => {
    mockSupabaseClient.from().select().order().mockResolvedValue({
      data: [],
      error: null
    });

    renderHook(() => useValidationTasks());

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('validation_tasks_with_ldap');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*');
      expect(mockSupabaseClient.from().select().order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  it('provides fetchTasks function', async () => {
    mockSupabaseClient.from().select().order().mockResolvedValue({
      data: [],
      error: null
    });

    const { result } = renderHook(() => useValidationTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.fetchTasks).toBe('function');

    // Call fetchTasks manually
    result.current.fetchTasks();

    // Should call supabase again
    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    });
  });

  it('provides updateTask function', async () => {
    const initialTasks = [
      { id: 'task-1', status: 'PENDING_VALIDATION', git_branch: 'feature/test' }
    ];

    mockSupabaseClient.from().select().order().mockResolvedValue({
      data: initialTasks,
      error: null
    });

    const { result } = renderHook(() => useValidationTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Update a task
    result.current.updateTask('task-1', { status: 'INTEGRATED' });

    expect(result.current.tasks[0].status).toBe('INTEGRATED');
  });

  it('provides addTask function', async () => {
    mockSupabaseClient.from().select().order().mockResolvedValue({
      data: [],
      error: null
    });

    const { result } = renderHook(() => useValidationTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newTask = {
      id: 'task-new',
      status: 'PENDING_VALIDATION' as const,
      git_branch: 'feature/new',
      current_commit_hash: 'abc123',
      diff_file_name: 'new.csv',
      diff_file_generated_at: '2023-01-01T10:00:00Z',
      generation_job_id: 'job-1',
      created_at: '2023-01-01T10:00:00Z',
      updated_at: '2023-01-01T10:00:00Z',
      created_by: 'user-1'
    };

    result.current.addTask(newTask);

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]).toEqual(newTask);
  });
});
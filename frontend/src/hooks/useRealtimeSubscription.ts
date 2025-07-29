import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UseRealtimeSubscriptionProps {
  table: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export const useRealtimeSubscription = ({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete
}: UseRealtimeSubscriptionProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Create a unique channel name
    const channelName = `${table}-${filter || 'all'}-${Date.now()}`;
    
    // Create the subscription
    let subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          ...(filter && { filter })
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload);
              break;
            case 'UPDATE':
              onUpdate?.(payload);
              break;
            case 'DELETE':
              onDelete?.(payload);
              break;
          }
        }
      );

    // Subscribe and store reference
    channelRef.current = subscription.subscribe();

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, onInsert, onUpdate, onDelete]);

  return channelRef.current;
};
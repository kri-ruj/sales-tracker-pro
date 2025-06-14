import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from 'react-query';
import { apiService } from '../services/api.service';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = apiService.getToken();
    if (!token) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:10000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Listen for real-time events
    socket.on('activity:created', (data) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries(['activities']);
      queryClient.invalidateQueries(['team']);
      console.log('New activity created:', data);
    });

    socket.on('activity:updated', (data) => {
      queryClient.invalidateQueries(['activities']);
      console.log('Activity updated:', data);
    });

    socket.on('activity:deleted', (data) => {
      queryClient.invalidateQueries(['activities']);
      console.log('Activity deleted:', data);
    });

    socket.on('leaderboard:update', (data) => {
      queryClient.invalidateQueries(['team']);
      console.log('Leaderboard updated:', data);
    });

    socket.on('achievement:unlocked', (data) => {
      // Show achievement notification
      console.log('Achievement unlocked:', data);
      // You could show a toast notification here
    });

    socketRef.current = socket;
  }, [queryClient]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    emit,
    isConnected: socketRef.current?.connected || false,
  };
}
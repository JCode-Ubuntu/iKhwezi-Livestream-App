import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const socketRef = useRef();

  useEffect(() => {
    // Connect to backend
    socketRef.current = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const joinRoom = (roomId) => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', roomId);
    }
  };

  const leaveRoom = (roomId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', roomId);
    }
  };

  const sendChatMessage = (roomId, message, userId, username) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', { roomId, message, userId, username });
    }
  };

  const sendReaction = (roomId, reaction, userId, username) => {
    if (socketRef.current) {
      socketRef.current.emit('reaction', { roomId, reaction, userId, username });
    }
  };

  const requestDuet = (roomId, userId, username) => {
    if (socketRef.current) {
      socketRef.current.emit('duet-request', { roomId, userId, username });
    }
  };

  const inviteCoHost = (roomId, userId, username) => {
    if (socketRef.current) {
      socketRef.current.emit('co-host-invite', { roomId, userId, username });
    }
  };

  const value = {
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    sendReaction,
    requestDuet,
    inviteCoHost
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
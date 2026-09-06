import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getServerUrl } from '../config/appConfig';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const userRoomRef = useRef(null);

  useEffect(() => {
    const origin = getServerUrl() || window.location.origin;
    const s = io(origin, {
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      reconnectionAttempts: 15,
      reconnectionDelay: 1500,
      timeout: 20000,
      withCredentials: false,
      auth: { token: token || '' },
    });
    socketRef.current = s;
    setSocket(s);
    s.on('connect', () => {
      console.log('Socket connected:', s.id);
      if (userRoomRef.current) s.emit('join-user-room', userRoomRef.current);
    });
    s.on('disconnect', (r) => console.log('Socket disconnected:', r));
    s.on('connect_error', (e) => console.warn('Socket error:', e.message));
    return () => { s.disconnect(); socketRef.current = null; };
  }, [token]);

  const joinRoom     = useCallback((id)                => socketRef.current?.emit('join-room',     id), []);
  const leaveRoom    = useCallback((id)                => socketRef.current?.emit('leave-room',    id), []);
  const joinUserRoom = useCallback((id) => {
    if (!id) return;
    userRoomRef.current = id;
    socketRef.current?.emit('join-user-room', id);
  }, []);
  const sendChatMessage = useCallback((room, msg) => socketRef.current?.emit('chat-message', { roomId: room, message: msg }), []);
  const sendReaction    = useCallback((room, rxn) => socketRef.current?.emit('reaction', { roomId: room, reaction: rxn }), []);
  const requestDuet     = useCallback((room, uid, uname)      => socketRef.current?.emit('duet-request', { roomId: room, userId: uid, username: uname }), []);
  const inviteCoHost    = useCallback((room, uid, uname)      => socketRef.current?.emit('co-host-invite', { roomId: room, userId: uid, username: uname }), []);

  // ---- Group Chat socket helpers ----
  const groupJoin        = useCallback((groupId) => socketRef.current?.emit('group-join', groupId), []);
  const groupLeave       = useCallback((groupId) => socketRef.current?.emit('group-leave', groupId), []);
  const groupTyping      = useCallback((groupId, isTyping) => socketRef.current?.emit('group-typing', { groupId, isTyping }), []);
  const groupRead         = useCallback((groupId, messageId) => socketRef.current?.emit('group-read', { groupId, messageId }), []);
  const groupReactSocket = useCallback((messageId, emoji) => socketRef.current?.emit('group-reaction', { messageId, emoji }), []);

  return (
    <SocketContext.Provider value={{
      socket, joinRoom, leaveRoom, joinUserRoom, sendChatMessage, sendReaction, requestDuet, inviteCoHost,
      groupJoin, groupLeave, groupTyping, groupRead, groupReactSocket,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

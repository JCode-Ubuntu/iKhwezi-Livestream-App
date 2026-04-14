import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Use same origin so nginx can proxy /socket.io to the backend container
    const s = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = s;
    setSocket(s);
    s.on('connect', () => console.log('Socket connected:', s.id));
    s.on('disconnect', (r) => console.log('Socket disconnected:', r));
    s.on('connect_error', (e) => console.warn('Socket error:', e.message));
    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  const joinRoom     = useCallback((id)                => socketRef.current?.emit('join-room',     id), []);
  const leaveRoom    = useCallback((id)                => socketRef.current?.emit('leave-room',    id), []);
  const joinUserRoom = useCallback((id)                => { if (id) socketRef.current?.emit('join-user-room', id); }, []);
  const sendChatMessage = useCallback((room, msg, uid, uname) => socketRef.current?.emit('chat-message', { roomId: room, message: msg, userId: uid, username: uname }), []);
  const sendReaction    = useCallback((room, rxn, uid, uname) => socketRef.current?.emit('reaction',     { roomId: room, reaction: rxn, userId: uid, username: uname }), []);
  const requestDuet     = useCallback((room, uid, uname)      => socketRef.current?.emit('duet-request', { roomId: room, userId: uid, username: uname }), []);
  const inviteCoHost    = useCallback((room, uid, uname)      => socketRef.current?.emit('co-host-invite', { roomId: room, userId: uid, username: uname }), []);

  return (
    <SocketContext.Provider value={{ socket, joinRoom, leaveRoom, joinUserRoom, sendChatMessage, sendReaction, requestDuet, inviteCoHost }}>
      {children}
    </SocketContext.Provider>
  );
};
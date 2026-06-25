import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = (token) => {
    // ✅ FIX 1: Prevent duplicate ghost sockets in React. 
    // Do NOT check .connected here. If the instance exists, return it.
    if (socketRef.current) return socketRef.current;

    // Use the exact backend URL
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => { 
      console.log('✅ Socket fully connected with ID:', socket.id);
      setConnected(true); 
    });
    
    socket.on('disconnect', () => { 
      console.warn('❌ Socket disconnected');
      setConnected(false); 
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ Socket connect error:', err.message);
    });

    socketRef.current = socket;
    return socket;
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  };

  const getSocket = () => socketRef.current;

  useEffect(() => {
    return () => disconnect();
  }, []);

  return (
    <SocketContext.Provider value={{ connect, disconnect, getSocket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
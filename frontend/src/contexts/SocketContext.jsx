import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = (token) => {
    if (socketRef.current?.connected) return socketRef.current;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => { setConnected(true); });
    socket.on('disconnect', () => { setConnected(false); });

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

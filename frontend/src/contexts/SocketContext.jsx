import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket]           = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  useEffect(() => {
    if (!user) return;
    const s = io('/', { withCredentials: true });
    s.emit('join', user._id);
    s.on('notification', (n) => {
      setNotifications(prev => [n, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    setSocket(s);
    return () => s.disconnect();
  }, [user]);

  const markOneRead = (id) => setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));

  return (
    <SocketContext.Provider value={{ socket, notifications, setNotifications, unreadCount, setUnreadCount, markOneRead }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

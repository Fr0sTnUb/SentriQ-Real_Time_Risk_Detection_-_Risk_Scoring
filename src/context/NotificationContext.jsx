import { createContext, useContext, useMemo, useState } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (type, message) => {
    const id = crypto.randomUUID();
    setNotifications((items) => [...items, { id, type, message, closing: false }]);
    window.setTimeout(() => {
      setNotifications((items) => items.filter((item) => item.id !== id));
    }, 5000);
  };

  const dismiss = (id) => {
    setNotifications((items) => items.filter((item) => item.id !== id));
  };

  const value = useMemo(() => ({ addNotification }), []);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-stack">
        {notifications.map((item) => (
          <div key={item.id} className={`notification notification-${item.type}`}>
            <button className="notification-close" onClick={() => dismiss(item.id)}>x</button>
            <span>{item.message}</span>
            <div className="notification-progress" />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used within NotificationProvider');
  return value;
}

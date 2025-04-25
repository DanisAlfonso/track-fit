import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastType } from '@/components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, action?: { label: string; onPress: () => void }) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(ToastContext);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const [duration, setDuration] = useState(3000);
  const [action, setAction] = useState<{ label: string; onPress: () => void } | undefined>(undefined);

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'success', 
    duration: number = 3000,
    action?: { label: string; onPress: () => void }
  ) => {
    setMessage(message);
    setType(type);
    setDuration(duration);
    setAction(action);
    setVisible(true);
  }, []);

  const hideToast = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast 
        visible={visible}
        message={message}
        type={type}
        duration={duration}
        onHide={hideToast}
        action={action}
      />
    </ToastContext.Provider>
  );
};

export default ToastContext; 
/** @jsxImportSource solid-js */

import {
  Component,
  JSX,
  createContext,
  useContext,
  createSignal,
} from 'solid-js';
import { ToastContainer } from './toast-container';
import { ToastProps, ToastType } from './toast';

interface ToastContextValue {
  showToast: (
    message: string,
    type?: ToastType,
    duration?: number
  ) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue>();

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export interface ToastProviderProps {
  children: JSX.Element;
}

export const ToastProvider: Component<ToastProviderProps> = (props) => {
  const [toasts, setToasts] = createSignal<ToastProps[]>([]);

  const generateId = (): string => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number = 5000
  ): string => {
    const id = generateId();
    const newToast: ToastProps = {
      id,
      message,
      type,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (message: string, duration: number = 5000): string => {
    return showToast(message, 'success', duration);
  };

  const error = (message: string, duration: number = 5000): string => {
    return showToast(message, 'error', duration);
  };

  const info = (message: string, duration: number = 5000): string => {
    return showToast(message, 'info', duration);
  };

  const warning = (message: string, duration: number = 5000): string => {
    return showToast(message, 'warning', duration);
  };

  const contextValue: ToastContextValue = {
    showToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {props.children}
      <ToastContainer toasts={toasts()} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

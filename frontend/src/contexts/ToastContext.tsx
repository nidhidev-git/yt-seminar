import React, { createContext, useContext, useState, useCallback } from 'react';
import { IconX, IconCheck, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000); // Auto remove after 5s
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-full max-w-xs pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-xl border backdrop-blur-md transition-all animate-in slide-in-from-right-5 fade-in duration-300
                            ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-100' : ''}
                            ${toast.type === 'error' ? 'bg-red-900/90 border-red-500/30 text-red-100' : ''}
                            ${toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/30 text-yellow-100' : ''}
                            ${toast.type === 'info' ? 'bg-gray-800/90 border-gray-600/30 text-gray-100' : ''}
                        `}
                    >
                        <div className="shrink-0 mt-0.5">
                            {toast.type === 'success' && <IconCheck size={18} />}
                            {toast.type === 'error' && <IconX size={18} />}
                            {toast.type === 'warning' && <IconAlertTriangle size={18} />}
                            {toast.type === 'info' && <IconInfoCircle size={18} />}
                        </div>
                        <p className="text-sm font-medium leading-tight">{toast.message}</p>
                        <button onClick={() => removeToast(toast.id)} className="ml-auto text-white/50 hover:text-white">
                            <IconX size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

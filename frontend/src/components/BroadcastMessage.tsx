import React from 'react';
import { Bell } from 'lucide-react';

interface BroadcastProps {
    message: string;
    timestamp: Date;
}

const BroadcastMessage: React.FC<BroadcastProps> = ({ message, timestamp }) => {
    return (
        <div className="bg-indigo-900/40 border border-indigo-500/30 p-3 rounded-lg flex gap-3 animate-fade-in">
            <div className="flex-shrink-0 mt-1">
                <Bell size={16} className="text-indigo-400" />
            </div>
            <div>
                <p className="text-indigo-100 text-sm leading-relaxed">{message}</p>
                <span className="text-[10px] text-indigo-400 mt-1 block">
                    {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};

export default BroadcastMessage;

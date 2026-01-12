import React, { useState } from 'react';
import { IconChartBar, IconX } from '@tabler/icons-react';

interface PollData {
    question: string;
    options: { text: string; votes: number }[];
    timeLeft: number;
}

interface PollModalProps {
    poll: PollData;
    onVote: (index: number) => void;
    isAdmin: boolean;
    onClose?: () => void; // Optional close for admin
}

const PollModal: React.FC<PollModalProps> = ({ poll, onVote, isAdmin, onClose }) => {
    const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes, 0);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    const handleVote = (idx: number) => {
        if (isAdmin || selectedIdx !== null) return;
        setSelectedIdx(idx);
        onVote(idx);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <IconChartBar size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Live Poll</h3>
                            <div className="text-xs text-indigo-300 font-mono mt-1">
                                Time Remaining: <span className={poll.timeLeft < 10 ? "text-red-400 font-bold" : "text-white font-bold"}>{poll.timeLeft}s</span>
                            </div>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                            <IconX size={20} />
                        </button>
                    )}
                </div>

                {/* Question */}
                <h4 className="text-lg font-medium text-gray-100 mb-6 leading-relaxed">
                    {poll.question}
                </h4>

                {/* Options */}
                <div className="space-y-3">
                    {poll.options.map((opt, idx) => {
                        const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                        const isSelected = selectedIdx === idx;

                        return (
                            <button
                                key={idx}
                                onClick={() => handleVote(idx)}
                                disabled={selectedIdx !== null && !isAdmin}
                                className={`w-full group relative overflow-hidden text-left p-4 rounded-lg border transition-all duration-200
                                    ${isSelected
                                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-indigo-500/50'}
                                    ${selectedIdx !== null && !isSelected ? 'opacity-50' : 'opacity-100'}
                                `}
                            >
                                {/* Progress Bar Background */}
                                {isAdmin && (
                                    <div
                                        className="absolute left-0 top-0 bottom-0 bg-indigo-500/10 transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                    />
                                )}

                                <div className="relative flex justify-between items-center z-10">
                                    <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{opt.text}</span>
                                    {isAdmin && (
                                        <span className="text-sm font-bold text-indigo-400">{percentage}% ({opt.votes})</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-gray-500">
                    <span>{isAdmin ? 'Real-time results visible to host' : 'Select an option to vote'}</span>
                    <span>{totalVotes} votes cast</span>
                </div>
            </div>
        </div>
    );
};

export default PollModal;

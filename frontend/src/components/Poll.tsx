import React from 'react';

interface PollOption {
    text: string;
    votes: number;
}

interface PollProps {
    question: string;
    options: PollOption[];
    onVote: (index: number) => void;
    hasVoted: boolean;
    isAdmin: boolean;
}

const Poll: React.FC<PollProps> = ({ question, options, onVote, hasVoted, isAdmin }) => {
    const totalVotes = options.reduce((acc, curr) => acc + curr.votes, 0);

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
            <h3 className="text-white font-semibold mb-3">{question}</h3>
            <div className="space-y-2">
                {options.map((opt, idx) => {
                    const percent = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                    return (
                        <div key={idx} className="relative">
                            {/* Background Bar */}
                            {(hasVoted || isAdmin) && (
                                <div
                                    className="absolute left-0 top-0 bottom-0 bg-blue-900/50 rounded"
                                    style={{ width: `${percent}%`, transition: 'width 0.5s' }}
                                />
                            )}

                            <button
                                disabled={hasVoted || isAdmin}
                                onClick={() => onVote(idx)}
                                className={`relative w-full text-left p-2 rounded border transition-colors flex justify-between items-center z-10
                                    ${hasVoted || isAdmin ? 'border-transparent cursor-default' : 'border-gray-600 hover:bg-gray-700 text-gray-200'}
                                `}
                            >
                                <span className="font-medium">{opt.text}</span>
                                {(hasVoted || isAdmin) && (
                                    <span className="text-xs font-bold text-blue-300">{percent}% ({opt.votes})</span>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
            {hasVoted && !isAdmin && <div className="mt-2 text-xs text-center text-gray-500">You have voted</div>}
            {isAdmin && <div className="mt-2 text-xs text-center text-gray-500">Live Results</div>}
        </div>
    );
};

export default Poll;

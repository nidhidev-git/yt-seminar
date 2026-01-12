import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_BASE_URL } from '../config';
import PollModal from '../components/PollModal';
import CustomVideoPlayer from '../components/CustomVideoPlayer';
import socketService from '../services/socket';
import { mediasoupClient } from '../services/mediasoupClient';
import { IconUsers, IconMicrophone, IconMicrophoneOff, IconHandStop, IconX, IconSettings, IconChartBar, IconSend, IconMessage, IconCrown, IconBrandYoutube, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';

interface Participant {
    id: string; // socket id
    name: string;
    role: 'host' | 'co-host' | 'user';
    isHandRaised: boolean;
    canProduceAudio?: boolean;
}

interface PollData {
    id: string;
    question: string;
    options: { text: string; votes: number }[];
    isActive: boolean;
    duration: number;
    timeLeft: number;
}

interface ChatMessage {
    name: string;
    message: string;
    timestamp: Date;
}

const MeetingRoom: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, login } = useAuth();
    const navigate = useNavigate();

    // State
    const [meeting, setMeeting] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [activePoll, setActivePoll] = useState<PollData | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');

    // Derived Role State
    const currentUserSocketId = socketService.getSocket()?.id;
    const currentUserParticipant = participants.find(p => p.id === currentUserSocketId);
    const isHost = user?.role?.toLowerCase() === 'admin';
    const isCoHost = currentUserParticipant?.role === 'co-host';
    const canModerate = isHost || isCoHost;

    const { addToast } = useToast();

    // Audio State
    const [isMicOn, setIsMicOn] = useState(false);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [showAudioSettings, setShowAudioSettings] = useState(false);

    // Modals & UI State
    const [showPollCreate, setShowPollCreate] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showHostPollResults, setShowHostPollResults] = useState(false);

    // Host Poll Creation State
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['Yes', 'No']);
    const [pollDuration, setPollDuration] = useState(30);

    const [showVideoUpdate, setShowVideoUpdate] = useState(false);
    const [videoInput, setVideoInput] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Socket Connection & Mediasoup Init
    useEffect(() => {
        if (!user || !id) return;

        const socket = socketService.connect();
        const socketRole = user.role?.toLowerCase() === 'admin' ? 'host' : 'user';
        socket.emit('join-room', { roomId: id, name: user.name, role: socketRole, userId: user.id });

        // Listeners
        socket.on('update-users', (users: Participant[]) => setParticipants(users));
        socket.on('poll-update', (poll: PollData) => {
            setActivePoll(poll);
            if (poll.isActive) {
                setShowHostPollResults(true);
            }
        });
        socket.on('poll-timer', (timeLeft: number) => setActivePoll(prev => prev ? { ...prev, timeLeft } : null));
        socket.on('poll-end', () => setActivePoll(prev => prev ? { ...prev, isActive: false, timeLeft: 0 } : null));
        socket.on('chat-history', (history: ChatMessage[]) => {
            setMessages(history.map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) })));
        });
        socket.on('chat-broadcast', (msg: { name: string, message: string, timestamp: string }) => {
            setMessages(prev => [...prev, { ...msg, timestamp: new Date(msg.timestamp) }]);
        });
        socket.on('video-update', (videoId: string) => {
            setMeeting((prev: any) => prev ? { ...prev, youtubeId: videoId } : null);
            addToast('Live Stream Updated', 'info');
        });
        socket.on('kicked', () => {
            addToast('You have been kicked by the host.', 'error');
            navigate('/');
        });

        socket.on('remote-audio-permission', ({ canProduce }: { canProduce: boolean }) => {
            if (canProduce) {
                addToast('Host has enabled your microphone access.', 'success');
            } else {
                if (isMicOn) {
                    mediasoupClient.closeProducer();
                    setIsMicOn(false);
                    addToast('Host has disabled your microphone access.', 'warning');
                } else {
                    addToast('Host has revoked your microphone permission.', 'warning');
                }
            }
        });

        socket.on('role-update', (newRole: 'co-host' | 'user') => {
            if (newRole === 'co-host') addToast('You have been promoted to Co-host!', 'success');
            else addToast('You have been demoted to User.', 'info');
            // The user list update will handle the visual role change independently
        });

        // Mediasoup Events
        socket.emit('getRouterRtpCapabilities', { roomId: id }, async (rtpCapabilities: any) => {
            if (rtpCapabilities && !rtpCapabilities.error) {
                await mediasoupClient.joinRoom(id, rtpCapabilities);
            }
        });

        socket.on('new-producer', ({ producerId }: { producerId: string }) => {
            mediasoupClient.consume(producerId);
        });

        return () => {
            socket.off('update-users');
            socket.off('poll-update');
            socket.off('poll-timer');
            socket.off('poll-end');
            socket.off('chat-history');
            socket.off('chat-broadcast');
            socket.off('video-update');
            socket.off('kicked');
            socket.off('new-producer');
            socketService.disconnect();
        };
    }, [user, id, navigate, addToast, isMicOn]);

    // Audio Device Enumeration on Settings Open
    useEffect(() => {
        if (showAudioSettings && audioDevices.length === 0) {
            (async () => {
                try {
                    // Request permission first to get labels
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop()); // Stop immediately

                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const inputs = devices.filter(d => d.kind === 'audioinput');
                    setAudioDevices(inputs);
                    if (inputs.length > 0 && !selectedDeviceId) setSelectedDeviceId(inputs[0].deviceId);
                } catch (err) {
                    console.warn('Microphone permission or enumeration failed', err);
                    addToast('Unable to list microphones. Please allow permission.', 'error');
                }
            })();
        }
    }, [showAudioSettings, audioDevices.length, addToast, selectedDeviceId]);

    // Initial Fetch
    useEffect(() => {
        const fetchMeeting = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}api/meetings/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMeeting(data);
                } else {
                    console.error('Meeting not found');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchMeeting();
    }, [id]);

    // Actions
    const handleGuestJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName.trim() || !guestEmail.trim()) return;
        login({
            id: `guest-${Date.now()}`,
            name: guestName,
            email: guestEmail,
            role: 'user',
            token: 'mock-token',
            avatar: ''
        });
    };

    const toggleHand = () => socketService.getSocket()?.emit('toggle-hand', { roomId: id });
    const castVote = (idx: number) => socketService.getSocket()?.emit('vote-poll', { roomId: id, optionIndex: idx });

    const sendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        socketService.getSocket()?.emit('chat-message', { roomId: id, message: chatInput, name: user?.name });
        setChatInput('');
        setShowBroadcast(false);
    };

    const handleHostAction = (action: 'mute' | 'kick' | 'lower-hand' | 'grant-audio' | 'revoke-audio' | 'promote-to-cohost' | 'demote-to-user', targetId: string) => {
        // Allow if admin (original host) or co-host (socket role)
        if (!isHost && !isCoHost) return;
        socketService.getSocket()?.emit('host-action', { roomId: id, action, targetId });
    };

    const createPoll = () => {
        if (!pollQuestion.trim()) return;
        socketService.getSocket()?.emit('create-poll', {
            roomId: id,
            question: pollQuestion,
            options: pollOptions.filter(o => o.trim() !== ''),
            duration: pollDuration
        });
        setShowPollCreate(false);
        setPollQuestion('');
        setPollOptions(['Yes', 'No']);
    };

    const handleUpdateVideo = (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoInput.trim()) return;
        socketService.getSocket()?.emit('update-video-id', { roomId: id, videoId: videoInput.trim() });
        setShowVideoUpdate(false);
        setVideoInput('');
    };

    const toggleMic = async () => {
        // Permission Check
        if (!isHost) {
            const myParticipant = participants.find(p => p.id === socketService.getSocket()?.id);
            if (!myParticipant?.canProduceAudio) {
                addToast('You do not have permission to use the microphone.', 'error');
                return;
            }
        }

        if (isMicOn) {
            await mediasoupClient.closeProducer();
            setIsMicOn(false);
            addToast('Microphone Muted', 'info');
        } else {
            // First time or every time: try to produce with current selection (or default)
            const success = await mediasoupClient.produceAudio(selectedDeviceId || undefined);
            if (success) {
                setIsMicOn(true);
                addToast('Microphone Active', 'success');

                // Lazy load devices if not loaded yet, to populate settings
                if (audioDevices.length === 0) {
                    try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const inputs = devices.filter(d => d.kind === 'audioinput');
                        setAudioDevices(inputs);
                        // Don't auto-set selectedDeviceId to avoid switching stream unexpectedly, 
                        // unless we want to reflect what's being used.
                    } catch (e) {
                        console.warn('Failed to enumerate devices', e);
                    }
                }
            }
            else addToast('Failed to access microphone', 'error');
        }
    };

    // Derived Grouping
    const hostsAndCoHosts = participants.filter(p => p.role === 'host' || p.role === 'co-host');
    const raisedHandUsers = participants.filter(p => p.isHandRaised && p.role === 'user');
    const normalUsers = participants.filter(p => !p.isHandRaised && p.role === 'user');

    const raisedHandCount = participants.filter(p => p.isHandRaised).length;
    const isHandRaised = currentUserParticipant?.isHandRaised;

    // Loading / Guest Join Views
    if (loading) return <div className="text-white">Loading meeting...</div>;
    if (!meeting) return <div className="text-white">Meeting not found.</div>;
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded shadow-lg max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Join "{meeting.title}"</h2>
                    <form onSubmit={handleGuestJoin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input type="text" className="w-full border border-gray-300 rounded p-2 text-black" placeholder="Your Name" value={guestName} onChange={e => setGuestName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" className="w-full border border-gray-300 rounded p-2 text-black" placeholder="your@email.com" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} required />
                        </div>
                        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-500 font-bold">Join Meeting</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-900 text-white font-sans relative overflow-hidden">

            {/* --- Modals --- */}

            {activePoll && activePoll.isActive && !canModerate && (
                <PollModal poll={activePoll} onVote={castVote} isAdmin={false} />
            )}

            {activePoll && showHostPollResults && canModerate && (
                <PollModal poll={activePoll} onVote={() => { }} isAdmin={true} onClose={() => setShowHostPollResults(false)} />
            )}

            {showPollCreate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><IconChartBar className="text-indigo-400" /> Create Poll</h3>
                        <button onClick={() => setShowPollCreate(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><IconX size={20} /></button>
                        <input className="w-full bg-gray-900 border border-gray-700 rounded p-3 mb-3 text-sm focus:border-indigo-500 outline-none" placeholder="Poll Question" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} />
                        <div className="space-y-2 mb-4">
                            {pollOptions.map((opt, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:border-indigo-500 outline-none" value={opt} onChange={e => { const n = [...pollOptions]; n[idx] = e.target.value; setPollOptions(n); }} />
                                    {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} className="text-red-500"><IconX size={16} /></button>}
                                </div>
                            ))}
                            <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs text-blue-400 font-bold hover:underline">+ Add Option</button>
                        </div>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-sm text-gray-400">Duration:</span>
                            <select className="bg-gray-900 border border-gray-700 rounded p-1 text-sm outline-none" value={pollDuration} onChange={e => setPollDuration(parseInt(e.target.value))}>
                                <option value={15}>15s</option>
                                <option value={30}>30s</option>
                                <option value={60}>60s</option>
                            </select>
                        </div>
                        <button onClick={createPoll} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold shadow-lg transition">Launch Poll</button>
                    </div>
                </div>
            )}

            {showBroadcast && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><IconSend className="text-indigo-400" /> Broadcast Message</h3>
                        <button onClick={() => setShowBroadcast(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><IconX size={20} /></button>
                        <form onSubmit={sendChat}>
                            <textarea className="w-full bg-gray-900 border border-gray-700 rounded p-3 mb-4 text-sm focus:border-indigo-500 outline-none min-h-[100px]" placeholder="Type your message to all participants..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
                            <button type="submit" disabled={!chatInput.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold shadow-lg transition disabled:opacity-50">Send Broadcast</button>
                        </form>
                    </div>
                </div>
            )}

            {showAudioSettings && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowAudioSettings(false)}>
                    <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2"><IconSettings size={20} /> Audio Settings</h3>
                        <label className="block text-xs text-gray-400 mb-1">Microphone Input</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-indigo-500"
                            value={selectedDeviceId}
                            onChange={(e) => {
                                setSelectedDeviceId(e.target.value);
                                if (isMicOn) { setIsMicOn(false); mediasoupClient.closeProducer(); alert('Mic changed. Please toggle ON again.'); }
                            }}
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}</option>
                            ))}
                        </select>
                        <button onClick={() => setShowAudioSettings(false)} className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white p-2 rounded text-sm font-medium">Done</button>
                    </div>
                </div>
            )}

            {/* --- Participants Drawer --- */}
            {showParticipants && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in" onClick={() => setShowParticipants(false)} />
            )}
            <aside className={`fixed inset-y-0 right-0 w-[85vw] md:w-80 bg-gray-900 border-l border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${showParticipants ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <h3 className="font-bold flex items-center gap-2"><IconUsers size={20} className="text-indigo-400" /> Participants ({participants.length})</h3>
                    <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white"><IconX /></button>
                </div>
                <div className="p-2 overflow-y-auto h-full pb-20 space-y-4">

                    {/* Group 1: Hosts & Co-hosts */}
                    {hostsAndCoHosts.length > 0 && (
                        <div className="mb-2">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 px-2">Hosts & Co-hosts</h4>
                            {hostsAndCoHosts.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.role === 'host' ? 'bg-indigo-600' : 'bg-purple-600'}`}>{p.name[0].toUpperCase()}</div>
                                        <div className="leading-tight">
                                            <p className="text-sm font-medium text-gray-200 flex items-center gap-1">
                                                {p.name} {p.id === currentUserSocketId && '(You)'}
                                                {p.isHandRaised && <IconHandStop size={14} className="text-yellow-500 animate-pulse" />}
                                            </p>
                                            <p className="text-[10px] text-gray-500 uppercase">{p.role}</p>
                                        </div>
                                    </div>
                                    {isHost && p.role === 'co-host' && (
                                        <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleHostAction('demote-to-user', p.id)} className="text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-600/30 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded transition whitespace-nowrap">
                                                Revoke Co-host
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Group 2: Raised Hands (With Mic Controls) */}
                    {raisedHandUsers.length > 0 && (
                        <div className="mb-2 bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-3">
                            <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2 flex items-center gap-1"><IconHandStop size={12} /> Raised Hands</h4>
                            {raisedHandUsers.map(p => (
                                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold">{p.name[0]}</div>
                                        <span className="text-sm text-gray-200">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canModerate && (
                                            <>
                                                {p.canProduceAudio ? (
                                                    <button onClick={() => handleHostAction('revoke-audio', p.id)} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 rounded transition" title="Mic is ON. Click to Mute.">
                                                        <IconMicrophone size={16} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleHostAction('grant-audio', p.id)} className="p-1.5 bg-gray-700 text-gray-400 hover:bg-green-500/20 hover:text-green-400 rounded transition" title="Mic is OFF. Click to Allow.">
                                                        <IconMicrophoneOff size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleHostAction('lower-hand', p.id)} className="text-[10px] text-yellow-500 hover:text-yellow-400 underline ml-1">Lower</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Group 3: Normal Participants */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 px-2">Participants ({normalUsers.length})</h4>
                        {normalUsers.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">{p.name[0].toUpperCase()}</div>
                                    <div className="leading-tight">
                                        <p className="text-sm font-medium text-gray-200">{p.name} {p.id === currentUserSocketId && '(You)'}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">{p.role}</p>
                                    </div>
                                </div>
                                {canModerate && (
                                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        {/* Main Host can Make Co-host */}
                                        {isHost && (
                                            <button onClick={() => handleHostAction('promote-to-cohost', p.id)} className="px-2 py-1 text-[10px] bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 rounded transition flex items-center gap-1 whitespace-nowrap" title="Promote to Co-host">
                                                <IconCrown size={12} /> Make Co-host
                                            </button>
                                        )}
                                        {/* Mic Controls for everyone */}
                                        {p.canProduceAudio ? (
                                            <button onClick={() => handleHostAction('revoke-audio', p.id)} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 rounded transition" title="Mic is ON. Click to Mute."><IconMicrophone size={16} /></button>
                                        ) : (
                                            <button onClick={() => handleHostAction('grant-audio', p.id)} className="p-1.5 bg-gray-700 text-gray-400 hover:bg-green-500/20 hover:text-green-400 rounded transition" title="Mic is OFF. Click to Allow."><IconMicrophoneOff size={16} /></button>
                                        )}
                                        <button onClick={() => handleHostAction('kick', p.id)} className="p-1 text-red-500 hover:text-red-400" title="Kick User"><IconX size={16} /></button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* --- Header --- */}
            <header className="bg-gray-800 border-b border-gray-700 h-16 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-30 shadow-md">
                <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                    <h1 className="font-bold text-lg tracking-tight hidden md:block">HexSeminar Live</h1>
                    <h1 className="font-bold text-lg tracking-tight md:hidden truncate max-w-[150px]">{meeting.title}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {/* Audio Settings (All Users) */}
                    <button onClick={() => setShowAudioSettings(true)} className="p-2 text-gray-400 hover:text-white bg-gray-700/50 rounded-lg mr-2" title="Audio Settings">
                        <IconSettings size={20} />
                    </button>

                    {canModerate && (
                        <>
                            <button onClick={() => setShowPollCreate(true)} className="p-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 rounded-lg transition border border-indigo-500/20 flex items-center gap-2" title="Create Poll">
                                <IconChartBar size={20} />
                                <span className="hidden md:inline text-sm font-medium">New Poll</span>
                            </button>
                            <button onClick={() => setShowBroadcast(true)} className="p-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 rounded-lg transition border border-emerald-500/20 flex items-center gap-2" title="Broadcast Message">
                                <IconSend size={20} />
                                <span className="hidden md:inline text-sm font-medium">Broadcast</span>
                            </button>
                            {meeting.youtubeId ? (
                                <button
                                    onClick={() => {
                                        if (confirm('Are you sure you want to STOP the stream? This will remove the video for all users.')) {
                                            socketService.getSocket()?.emit('update-video-id', { roomId: id, videoId: '' });
                                        }
                                    }}
                                    className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded-lg transition border border-red-500/20 flex items-center gap-2"
                                    title="Stop Stream"
                                >
                                    <IconPlayerStop size={20} />
                                    <span className="hidden md:inline text-sm font-medium">Stop</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowVideoUpdate(true)}
                                    className="p-2 bg-green-600/10 text-green-500 hover:bg-green-600/20 rounded-lg transition border border-green-500/20 flex items-center gap-2"
                                    title="Start Stream"
                                >
                                    <IconPlayerPlay size={20} />
                                    <span className="hidden md:inline text-sm font-medium">Start / Update Stream</span>
                                </button>
                            )}
                            <div className="h-6 w-px bg-gray-700 mx-1"></div>
                        </>
                    )}
                    <button onClick={() => setShowParticipants(!showParticipants)} className="relative p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-700">
                        <IconUsers size={24} />
                        {raisedHandCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full animate-bounce"></span>}
                    </button>
                </div>
            </header>

            {/* Edit Video Modal */}
            {showVideoUpdate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500"><IconBrandYoutube size={24} /> Update Live Stream</h3>
                        <button onClick={() => setShowVideoUpdate(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><IconX size={20} /></button>
                        <form onSubmit={handleUpdateVideo}>
                            <label className="block text-sm text-gray-400 mb-2">YouTube Video ID or URL</label>
                            <input className="w-full bg-gray-900 border border-gray-700 rounded p-3 mb-4 text-sm focus:border-red-500 outline-none text-white" placeholder="e.g. jNQXAC9IVRw" value={videoInput} onChange={e => setVideoInput(e.target.value)} autoFocus />
                            <button type="submit" disabled={!videoInput.trim()} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold shadow-lg transition disabled:opacity-50">Update Stream</button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Main Content --- */}
            <div className="pt-16 flex flex-col md:flex-row h-[100dvh] overflow-hidden">
                {/* Video Section: Auto height on mobile (aspect-video), Full height/flex-1 on Desktop */}
                <div className="w-full md:flex-1 bg-black relative flex flex-col justify-center overflow-hidden shrink-0 md:h-full">
                    <div className="w-full aspect-video md:h-full md:w-full md:aspect-auto relative">
                        <CustomVideoPlayer videoId={meeting.youtubeId} />
                        {/* Controls Overlay */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex gap-3 md:gap-4 items-center w-full justify-center px-4">
                            <button
                                onClick={toggleMic}
                                className={`pointer-events-auto w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold text-sm shadow-lg transition-all transform hover:scale-105 active:scale-95 border-2 ${isMicOn ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/50' : 'bg-red-600 border-red-400 text-white shadow-red-500/50'}`}
                                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                            >
                                {isMicOn ? <IconMicrophone size={20} className="md:w-7 md:h-7" /> : <IconMicrophoneOff size={20} className="md:w-7 md:h-7" />}
                            </button>

                            {!isHost && (
                                <button onClick={toggleHand} className={`pointer-events-auto px-4 py-2 md:px-6 md:py-2.5 rounded-full font-bold text-xs md:text-sm shadow-lg flex items-center gap-2 transition transform hover:scale-105 ${isHandRaised ? 'bg-yellow-500 text-black' : 'bg-gray-900/60 text-white backdrop-blur border border-white/10 hover:bg-gray-800'}`}>
                                    <IconHandStop size={16} className="md:w-[18px]" /> {isHandRaised ? 'HAND RAISED' : 'RAISE HAND'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Broadcast/Chat Section: Fills remaining space on mobile */}
                <div className="flex-1 md:flex-none md:w-[400px] bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 flex flex-col min-h-0 relative z-0 shadow-xl">
                    <div className="p-3 border-b border-gray-800 bg-gray-800/30 flex items-center justify-between shrink-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><IconMessage size={14} /> Live Broadcasts</h3>
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">LIVE</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-2">
                                <IconMessage size={48} className="stroke-1 opacity-20" />
                                <p className="text-sm font-medium opacity-50">No broadcasts yet</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shrink-0 mt-1">{msg.name[0].toUpperCase()}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-300 truncate">{msg.name}</span>
                                            <span className="text-[10px] text-gray-600">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl rounded-tl-sm p-3 text-sm text-gray-200 shadow-sm break-words leading-relaxed">{msg.message}</div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 text-center border-t border-gray-800 bg-gray-800/20 shrink-0">
                        {canModerate ? (
                            <button onClick={() => setShowBroadcast(true)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center justify-center gap-1 w-full py-2 rounded hover:bg-white/5 transition"><IconSend size={14} /> Post a new broadcast</button>
                        ) : (
                            <p className="text-xs text-gray-600 italic flex items-center justify-center gap-1"><IconCrown size={12} /> Broadcast channel</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingRoom;

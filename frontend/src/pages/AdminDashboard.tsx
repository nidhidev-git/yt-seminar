import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import {
    IconLayoutDashboard, IconPlus, IconVideo, IconTrash, IconEdit, IconCopy,
    IconLoader, IconSearch, IconX, IconCalendarEvent, IconUsers
} from '@tabler/icons-react';

interface Meeting {
    _id: string;
    title: string;
    description?: string;
    youtubeId?: string;
    scheduledTime: string;
    hostId: string;
}

const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Redirect if not logged in
    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
    }, [user, navigate]);

    // Data State
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Create State
    const [createTitle, setCreateTitle] = useState('');
    const [createYoutubeId, setCreateYoutubeId] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    // Edit State
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    // Fetch existing meetings
    const fetchMeetings = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}api/meetings`);
            const data = await res.json();
            setMeetings(data);
        } catch (err) {
            console.error("Failed to fetch meetings", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    // Create Handler
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const token = user?.token || localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}api/meetings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: createTitle, youtubeId: extractYoutubeId(createYoutubeId) })
            });

            if (res.ok) {
                const newMeeting = await res.json();
                setMeetings([...meetings, newMeeting]);
                setCreateTitle('');
                setCreateYoutubeId('');
                alert('Meeting Created Successfully!');
            } else {
                alert('Failed to create meeting');
            }
        } catch (err) {
            console.error(err);
            alert('Error creating meeting');
        } finally {
            setCreateLoading(false);
        }
    };

    // Update Handler
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMeeting) return;
        setEditLoading(true);

        try {
            const token = user?.token || localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}api/meetings/${editingMeeting._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: editingMeeting.title,
                    youtubeId: extractYoutubeId(editingMeeting.youtubeId || ''),
                    description: editingMeeting.description,
                    scheduledTime: editingMeeting.scheduledTime
                })
            });

            if (res.ok) {
                const updated = await res.json();
                setMeetings(meetings.map(m => m._id === updated._id ? updated : m));
                setEditingMeeting(null);
                alert('Meeting Updated Successfully!');
            } else {
                alert('Failed to update meeting');
            }
        } catch (err) {
            console.error(err);
            alert('Error updating meeting');
        } finally {
            setEditLoading(false);
        }
    };

    // Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) return;

        try {
            const token = user?.token || localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}api/meetings/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setMeetings(meetings.filter(m => m._id !== id));
            } else {
                alert('Failed to delete meeting');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting meeting');
        }
    };

    // Helpers
    const extractYoutubeId = (urlOrId: string) => {
        // Handle full Iframe tag
        if (urlOrId.includes('<iframe')) {
            const srcMatch = urlOrId.match(/src=["'](.*?)["']/);
            if (srcMatch && srcMatch[1]) {
                urlOrId = srcMatch[1];
            }
        }

        // Handle various YouTube URL formats
        const regExp = /^.*(youtu.be\/|v\/|u\/\w+\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = urlOrId.match(regExp);

        return (match && match[2].length === 11) ? match[2] : urlOrId;
    };

    const copyLink = (id: string) => {
        const link = `${window.location.origin}/meeting/${id}`;
        navigator.clipboard.writeText(link);
        alert('Link copied!');
    };

    const filteredMeetings = meetings.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m._id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-indigo-500/30">
            {/* Navigation */}
            <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 rounded-lg p-1.5"><IconLayoutDashboard size={20} className="text-white" /></div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Admin Console</h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-sm text-gray-400 hidden sm:block">Signed in as <span className="text-white font-medium">{user?.name}</span></span>
                        <button onClick={logout} className="text-sm font-medium text-red-400 hover:text-red-300 transition px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20">Sign Out</button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Create Section */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-6 sticky top-24 backdrop-blur-sm">
                            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                <IconPlus className="text-indigo-400" /> Create Seminar
                            </h2>
                            <form onSubmit={handleCreate} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Event Title</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                                        placeholder="e.g. Q1 Product Launch"
                                        value={createTitle}
                                        onChange={e => setCreateTitle(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">YouTube Video ID / URL</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"><IconVideo size={18} /></div>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                                            placeholder="Wait for Update..."
                                            value={createYoutubeId}
                                            onChange={e => setCreateYoutubeId(e.target.value)}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Paste full URL or ID. Leave empty if checking later.</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {createLoading ? <IconLoader className="animate-spin" size={20} /> : 'Create Event'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <IconCalendarEvent className="text-emerald-400" /> Upcoming Seminars
                                <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{meetings.length}</span>
                            </h2>
                            <div className="relative">
                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search events..."
                                    className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20"><IconLoader className="text-indigo-500 animate-spin" size={40} /></div>
                        ) : filteredMeetings.length === 0 ? (
                            <div className="bg-gray-800/30 border border-gray-700/50 rounded-2xl p-10 text-center">
                                <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><IconCalendarEvent size={32} className="text-gray-600" /></div>
                                <h3 className="text-gray-300 font-medium mb-1">{searchTerm ? 'No matching seminars found' : 'No seminars scheduled'}</h3>
                                <p className="text-gray-500 text-sm">Create a new seminar to get started.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredMeetings.map(meeting => (
                                    <div key={meeting._id} className="group bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 rounded-2xl p-5 transition-all duration-300 flex flex-col sm:flex-row gap-5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-bold text-lg text-white truncate pr-4">{meeting.title}</h3>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${meeting.youtubeId ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                                                    {meeting.youtubeId ? 'Stream Set' : 'No Stream'}
                                                </span>
                                            </div>
                                            <p className="text-gray-400 text-xs mb-4 flex items-center gap-2">
                                                <span>{new Date(meeting.scheduledTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                                <span className="truncate max-w-[200px]">ID: {meeting.youtubeId || 'Not Set'}</span>
                                            </p>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <button onClick={() => navigate(`/meeting/${meeting._id}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition">
                                                    <IconUsers size={14} /> Join Room
                                                </button>
                                                <button onClick={() => copyLink(meeting._id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg transition">
                                                    <IconCopy size={14} /> Copy Link
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex sm:flex-col gap-2 border-t sm:border-t-0 sm:border-l border-gray-700/50 pt-4 sm:pt-0 sm:pl-4 justify-center">
                                            <button
                                                onClick={() => setEditingMeeting(meeting)}
                                                className="flex-1 sm:flex-none p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
                                                title="Edit"
                                            >
                                                <IconEdit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(meeting._id)}
                                                className="flex-1 sm:flex-none p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                                title="Delete"
                                            >
                                                <IconTrash size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Edit Modal */}
            {editingMeeting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button onClick={() => setEditingMeeting(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition"><IconX size={20} /></button>

                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><IconEdit size={24} /></div>
                                Edit Seminar
                            </h3>

                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Event Title</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        value={editingMeeting.title}
                                        onChange={e => setEditingMeeting({ ...editingMeeting, title: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1.5">YouTube ID</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={editingMeeting.youtubeId || ''}
                                            onChange={e => setEditingMeeting({ ...editingMeeting, youtubeId: e.target.value })}
                                        />
                                    </div>
                                    {/* Minimal Date support for now, can be expanded later */}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Description (Optional)</label>
                                    <textarea
                                        className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
                                        value={editingMeeting.description || ''}
                                        onChange={e => setEditingMeeting({ ...editingMeeting, description: e.target.value })}
                                    ></textarea>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setEditingMeeting(null)} className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-700 font-medium transition">Cancel</button>
                                    <button type="submit" disabled={editLoading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition shadow-lg shadow-indigo-500/20">
                                        {editLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;

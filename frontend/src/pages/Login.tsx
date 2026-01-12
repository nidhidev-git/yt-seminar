import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import { Navigate } from 'react-router-dom';

const Login: React.FC = () => {
    const { login, user } = useAuth();
    const [formData, setFormData] = React.useState({ email: '', password: '' });
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (formData.email && formData.password) {
            try {
                const res = await fetch(`${API_BASE_URL}api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email, password: formData.password })
                });
                const data = await res.json();
                if (res.ok) {
                    login({
                        id: data._id,
                        name: data.name,
                        email: data.email,
                        role: data.role,
                        token: data.token,
                        avatar: data.avatar || `https://ui-avatars.com/api/?name=${data.name}`
                    });
                } else {
                    setError(data.message || 'Login failed');
                }
            } catch (err) {
                console.error(err);
                setError('Network error. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    };

    if (user) {
        return <Navigate to={user.role === 'admin' ? '/admin' : `/meeting/${user.id}`} />; // Redirect admin to dashboard, others? maybe nowhere if logic changes
    }

    // Actually, if user is already logged in as 'user' (guest) and tries to go to login, 
    // maybe we should let them logout or just redirect to home? 
    // For now, let's assume if they are here they want to login as admin.

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden p-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
                    Admin Login
                </h2>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full border border-gray-300 px-4 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="admin@hexseminar.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full border border-gray-300 px-4 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded transition duration-200 mt-6 disabled:opacity-50"
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;

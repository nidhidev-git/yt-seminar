// In production (with Nginx), this should default to relative path '/'
// In dev (without Nginx), it might need to be 'http://localhost:5000'
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/';

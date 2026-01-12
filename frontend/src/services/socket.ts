import { io, Socket } from 'socket.io-client';

class SocketService {
    private socket: Socket | null = null;

    connect() {
        if (!this.socket) {
            // Use relative path so it respects the domain/proxy
            // If dev, Vite proxy or manuall override can be used.
            const url = import.meta.env.VITE_API_URL || '/';
            this.socket = io(url, {
                path: '/socket.io'
            });
        }
        return this.socket;
    }

    getSocket() {
        if (!this.socket) {
            return this.connect();
        }
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

export default new SocketService();

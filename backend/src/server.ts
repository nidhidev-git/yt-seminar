import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import meetingRoutes from './routes/meeting';

// Load env vars
dotenv.config();
console.log('Environment Variables Loaded. MONGO_URI Length:', process.env.MONGO_URI?.length || 0);
console.log('Mediasoup Config:', {
    minPort: process.env.MEDIASOUP_MIN_PORT,
    maxPort: process.env.MEDIASOUP_MAX_PORT,
    announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP
});

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// Routes Placeholder
app.get('/', (req, res) => {
    res.send('HexSeminar API Running');
});

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", // Update this in production
        methods: ["GET", "POST"]
    }
});

import { meetingSocketHandler } from './sockets/meetingSocket';
import { mediasoupService } from './services/mediasoupService';

// Initialize Mediasoup Worker
mediasoupService.init().catch(err => {
    console.error('Failed to init Mediasoup:', err);
    process.exit(1);
});

meetingSocketHandler(io);

const PORT = process.env.PORT || 5000;

const serverApp = server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err: any, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    // serverApp.close(() => process.exit(1)); // In production, usually best to restart via PM2
    console.error('Unhandled Rejection at:', promise, 'reason:', err);
});

// Handle Uncaught Exceptions
process.on('uncaughtException', (err: any) => {
    console.log(`Uncaught Exception: ${err.message}`);
    console.error(err);
    process.exit(1);
});

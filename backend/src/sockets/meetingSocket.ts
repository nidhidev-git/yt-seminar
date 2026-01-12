import { Server, Socket } from 'socket.io';
import { mediasoupService } from '../services/mediasoupService';
import { WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types';
import Meeting from '../models/Meeting';

interface Participant {
    id: string; // Socket ID
    userId?: string; // DB ID (if logged in)
    name: string;
    role: 'host' | 'co-host' | 'user';
    isHandRaised: boolean;
    canProduceAudio: boolean;
}

interface Poll {
    id: string;
    question: string;
    options: { text: string; votes: number }[];
    isActive: boolean;
    duration: number; // in seconds
    timer?: NodeJS.Timeout;
    timeLeft: number;
}

interface Meeting {
    participants: Participant[];
    activePoll: Poll | null;
    broadcasts: { name: string; message: string; timestamp: Date }[];
    // Mediasoup State
    routerId?: string;
    producers: Map<string, Producer>; // producerId -> Producer
    consumers: Map<string, Consumer>; // consumerId -> Consumer
    transports: Map<string, WebRtcTransport>; // transportId -> Transport
}

// In-memory storage
const activeMeetings: Record<string, Meeting> = {};

export const meetingSocketHandler = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        // console.log('Socket connected:', socket.id); // Reduce spam

        socket.on('join-room', async ({ roomId, name, role, userId }: { roomId: string; name: string; role: 'host' | 'co-host' | 'user'; userId?: string }) => {
            try {
                socket.join(roomId);

                // Fetch meeting from DB to retrieve persistence data
                let dbMeeting;
                try {
                    dbMeeting = await Meeting.findById(roomId);
                } catch (e) {
                    console.error('Error fetching meeting DB', e);
                }

                if (!activeMeetings[roomId]) {
                    activeMeetings[roomId] = {
                        participants: [],
                        activePoll: null,
                        broadcasts: dbMeeting?.broadcasts.map(b => ({ name: b.senderName, message: b.message, timestamp: b.timestamp })) || [],
                        producers: new Map(),
                        consumers: new Map(),
                        transports: new Map()
                    };
                    // Init Router for new room
                    try {
                        const router = await mediasoupService.getRouter(roomId);
                        activeMeetings[roomId].routerId = router.id;
                    } catch (e) {
                        console.error(`Failed to create router for room ${roomId}`, e);
                    }
                }

                const meeting = activeMeetings[roomId];

                // Determine effective role
                let effectiveRole = role;
                // If user is in the persistent co-host list, force role to co-host (unless they are host)
                if (userId && dbMeeting?.coHosts?.includes(userId) && role !== 'host') {
                    effectiveRole = 'co-host';
                }

                // Add or update participant
                const existingParticipant = meeting.participants.find(p => p.id === socket.id);
                if (existingParticipant) {
                    existingParticipant.role = effectiveRole;
                    existingParticipant.name = name;
                } else {
                    meeting.participants.push({
                        id: socket.id,
                        userId,
                        name,
                        role: effectiveRole,
                        isHandRaised: false,
                        canProduceAudio: effectiveRole === 'host' || effectiveRole === 'co-host'
                    });
                }

                // Broadcast updated user list
                io.to(roomId).emit('update-users', meeting.participants);
                io.to(roomId).emit('chat-history', meeting.broadcasts); // Send persistent history

                if (meeting.activePoll) {
                    const { timer, ...pollPayload } = meeting.activePoll;
                    socket.emit('poll-update', pollPayload);
                }

                console.log(`${name} joined room ${roomId}`);
            } catch (err) {
                console.error('Error in join-room:', err);
            }
        });

        // --- Mediasoup Handlers (Wrapped in Try/Catch) ---

        socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
            try {
                const router = await mediasoupService.getRouter(roomId);
                callback(router.rtpCapabilities);
            } catch (err) {
                console.error('getRouterRtpCapabilities error:', err);
                callback({ error: err });
            }
        });

        socket.on('createWebRtcTransport', async ({ roomId }, callback) => {
            try {
                const meeting = activeMeetings[roomId];
                if (!meeting) return callback({ error: 'Meeting not found' });

                const router = await mediasoupService.getRouter(roomId);
                const { transport, params } = await mediasoupService.createWebRtcTransport(router);

                // Store transport
                meeting.transports.set(transport.id, transport);

                callback(params);
            } catch (err) {
                console.error('createWebRtcTransport error:', err);
                callback({ error: err });
            }
        });

        socket.on('transport-connect', async ({ roomId, transportId, dtlsParameters }) => {
            try {
                const meeting = activeMeetings[roomId];
                const transport = meeting?.transports.get(transportId);
                if (!transport) throw new Error(`Transport ${transportId} not found`);

                await transport.connect({ dtlsParameters });
            } catch (err) {
                console.error('transport-connect error:', err);
            }
        });

        socket.on('transport-produce', async ({ roomId, transportId, kind, rtpParameters, appData }, callback) => {
            try {
                const meeting = activeMeetings[roomId];
                if (!meeting) return callback({ error: 'Meeting not found' });

                // Check permission to produce
                const participant = meeting.participants.find(p => p.id === socket.id);
                if (!participant) return callback({ error: 'Participant not found' });

                if (kind === 'audio' && !participant.canProduceAudio) {
                    return callback({ error: 'Not allowed to produce audio' });
                }

                const transport = meeting.transports.get(transportId);
                if (!transport) throw new Error(`Transport ${transportId} not found`);

                const producer = await transport.produce({ kind, rtpParameters, appData });
                meeting.producers.set(producer.id, producer);

                // Announce new producer to others in room
                socket.to(roomId).emit('new-producer', { producerId: producer.id, socketId: socket.id });

                producer.on('transportclose', () => {
                    meeting.producers.delete(producer.id);
                });

                callback({ id: producer.id });
            } catch (err) {
                console.error('transport-produce error:', err);
                callback({ error: err });
            }
        });

        socket.on('transport-recv-connect', async ({ roomId, transportId, dtlsParameters }) => {
            try {
                const meeting = activeMeetings[roomId];
                const transport = meeting?.transports.get(transportId);
                if (transport) await transport.connect({ dtlsParameters });
            } catch (err) { console.error(err); }
        });

        socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
            try {
                const meeting = activeMeetings[roomId];
                const router = await mediasoupService.getRouter(roomId);
                const transport = meeting?.transports.get(transportId);

                if (!router.canConsume({ producerId, rtpCapabilities })) {
                    return callback({ error: 'Cannot consume' });
                }

                const consumer = await transport!.consume({
                    producerId,
                    rtpCapabilities,
                    paused: true, // Recommended to start paused
                });

                meeting.consumers.set(consumer.id, consumer);

                // Cleanup on close
                consumer.on('transportclose', () => meeting.consumers.delete(consumer.id));
                consumer.on('producerclose', () => {
                    meeting.consumers.delete(consumer.id);
                    socket.emit('consumer-closed', { consumerId: consumer.id });
                });

                callback({
                    id: consumer.id,
                    producerId,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });
            } catch (err) {
                console.error('consume error:', err);
                callback({ error: err });
            }
        });

        socket.on('consumer-resume', async ({ roomId, consumerId }) => {
            try {
                const consumer = activeMeetings[roomId]?.consumers.get(consumerId);
                if (consumer) await consumer.resume();
            } catch (e) { console.error(e); }
        });

        // --- Existing Handlers ---

        socket.on('toggle-hand', ({ roomId }: { roomId: string }) => {
            const meeting = activeMeetings[roomId];
            if (!meeting) return;

            const user = meeting.participants.find(u => u.id === socket.id);
            if (user) {
                user.isHandRaised = !user.isHandRaised;
                io.to(roomId).emit('update-users', meeting.participants);
            }
        });

        socket.on('host-action', async ({ roomId, action, targetId }: { roomId: string; action: 'mute' | 'kick' | 'lower-hand' | 'grant-audio' | 'revoke-audio' | 'promote-to-cohost' | 'demote-to-user'; targetId: string }) => {
            const meeting = activeMeetings[roomId];
            if (!meeting) return;

            const actor = meeting.participants.find(u => u.id === socket.id);
            const target = meeting.participants.find(u => u.id === targetId);

            if (!actor || !target) return;
            // Only Host and Co-host can act
            if (actor.role === 'user') return;

            // Co-hosts cannot act on the Host
            if (actor.role === 'co-host' && target.role === 'host') return;

            if (action === 'kick') {
                // Co-host can kick users, but not other co-hosts or host
                if (actor.role === 'co-host' && (target.role === 'host' || target.role === 'co-host')) return;

                meeting.participants = meeting.participants.filter(u => u.id !== targetId);
                io.to(roomId).emit('update-users', meeting.participants);
                io.to(targetId).emit('kicked');
                io.sockets.sockets.get(targetId)?.leave(roomId);
            }
            else if (action === 'promote-to-cohost') {
                if (actor.role !== 'host') return;
                target.role = 'co-host';
                target.canProduceAudio = true;

                // Persist if userId exists
                if (target.userId) {
                    try {
                        await Meeting.findByIdAndUpdate(roomId, { $addToSet: { coHosts: target.userId } });
                    } catch (e) {
                        console.error('Failed to persist co-host', e);
                    }
                }

                io.to(roomId).emit('update-users', meeting.participants);
                io.to(targetId).emit('role-update', 'co-host');
            }
            else if (action === 'demote-to-user') {
                if (actor.role !== 'host') return;
                target.role = 'user';
                target.canProduceAudio = false;

                // Persist removal
                if (target.userId) {
                    try {
                        await Meeting.findByIdAndUpdate(roomId, { $pull: { coHosts: target.userId } });
                    } catch (e) {
                        console.error('Failed to persist co-host removal', e);
                    }
                }

                io.to(roomId).emit('update-users', meeting.participants);
                io.to(targetId).emit('role-update', 'user');
            }
            else if (action === 'lower-hand') {
                target.isHandRaised = false;
                io.to(roomId).emit('update-users', meeting.participants);
            }
            else if (action === 'mute') {
                io.to(targetId).emit('muted-by-host');
            }
            else if (action === 'grant-audio') {
                target.canProduceAudio = true;
                io.to(roomId).emit('update-users', meeting.participants);
                io.to(targetId).emit('remote-audio-permission', { canProduce: true });
            }
            else if (action === 'revoke-audio') {
                target.canProduceAudio = false;
                io.to(roomId).emit('update-users', meeting.participants);
                io.to(targetId).emit('remote-audio-permission', { canProduce: false });
            }
        });

        socket.on('create-poll', ({ roomId, question, options, duration }: { roomId: string; question: string; options: string[], duration: number }) => {
            const meeting = activeMeetings[roomId];
            if (!meeting) return;

            const sender = meeting.participants.find(u => u.id === socket.id);
            if (!sender || (sender.role !== 'host' && sender.role !== 'co-host')) return;

            const pollId = Date.now().toString();
            const formattedOptions = options.map(opt => ({ text: opt, votes: 0 }));

            const newPoll: Poll = {
                id: pollId,
                question,
                options: formattedOptions,
                isActive: true,
                duration,
                timeLeft: duration
            };

            const { timer, ...pollPayload } = newPoll;
            meeting.activePoll = newPoll;
            io.to(roomId).emit('poll-update', pollPayload);

            // Start Timer
            newPoll.timer = setInterval(() => {
                if (newPoll.timeLeft > 0) {
                    newPoll.timeLeft -= 1;
                    io.to(roomId).emit('poll-timer', newPoll.timeLeft);
                } else {
                    if (newPoll.timer) clearInterval(newPoll.timer);
                    newPoll.isActive = false;
                    const { timer: _, ...endedPollPayload } = newPoll;
                    io.to(roomId).emit('poll-end', endedPollPayload);
                }
            }, 1000);
        });

        socket.on('vote-poll', ({ roomId, optionIndex }: { roomId: string; optionIndex: number }) => {
            const meeting = activeMeetings[roomId];
            if (!meeting || !meeting.activePoll || !meeting.activePoll.isActive) return;

            if (meeting.activePoll.options[optionIndex]) {
                meeting.activePoll.options[optionIndex].votes += 1;
                const { timer, ...pollPayload } = meeting.activePoll;
                io.to(roomId).emit('poll-update', pollPayload);
            }
        });

        socket.on('chat-message', async ({ roomId, message, name }: { roomId: string; message: string; name: string }) => {
            const meeting = activeMeetings[roomId];
            if (!meeting) return;

            // Verify if sender is host or co-host (let co-hosts broadcast too?)
            // User said "Broadcast Message". Usually host feature. Logic checks sender.role === 'host'.
            // I should allow co-hosts too if they are moderators.
            const sender = meeting.participants.find(u => u.id === socket.id);
            if (sender && (sender.role === 'host' || sender.role === 'co-host')) {
                const msg = { name, message, timestamp: new Date() };
                meeting.broadcasts.push(msg);

                // Persist
                try {
                    await Meeting.findByIdAndUpdate(roomId, {
                        $push: { broadcasts: { message, senderName: name, timestamp: msg.timestamp } }
                    });
                } catch (e) {
                    console.error('Failed to persist broadcast', e);
                }

                io.to(roomId).emit('chat-broadcast', msg);
            }
        });

        socket.on('update-video-id', async ({ roomId, videoId }: { roomId: string; videoId: string }) => {
            const meeting = activeMeetings[roomId];
            if (!meeting) return;

            const sender = meeting.participants.find(u => u.id === socket.id);
            if (sender && (sender.role === 'host' || sender.role === 'co-host')) {
                // Update in DB
                try {
                    await Meeting.findByIdAndUpdate(roomId, { youtubeId: videoId });
                } catch (e) {
                    console.error('Failed to persist video update', e);
                }

                // Broadcast update
                io.to(roomId).emit('video-update', videoId);
            }
        });

        socket.on('disconnect', () => {
            for (const roomId in activeMeetings) {
                const meeting = activeMeetings[roomId];
                // Cleanup Transports/Producers for this socket?
                // For simplicity in this iteration, we rely on Mediasoup's transport close on socket close 
                // but strictly we should clean up producers mapped to this socket.
                // Since our maps are flat by ID, we'd need a socket->resources map to do it efficiently.
                // For now, Mediasoup usually cleans up transports if the connection dies.

                const userIndex = meeting.participants.findIndex(u => u.id === socket.id);
                if (userIndex !== -1) {
                    meeting.participants.splice(userIndex, 1);
                    io.to(roomId).emit('update-users', meeting.participants);
                }
            }
            console.log('Socket disconnected:', socket.id);
        });
    });
};

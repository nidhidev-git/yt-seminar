import * as mediasoup from 'mediasoup';
import { Worker, Router, WebRtcTransport, Producer, Consumer, RtpCodecCapability } from 'mediasoup/node/lib/types';

// Audio-only configuration for bandwidth optimization
const mediaCodecs: RtpCodecCapability[] = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 111,
        parameters: {
            useinbandfec: 1,
            minptime: 10
        }
    }
];

class MediasoupService {
    private worker: Worker | null = null;
    private routers: Map<string, Router> = new Map(); // roomId -> Router

    constructor() {
        this.startWorker();
    }

    private async startWorker() {
        try {
            this.worker = await mediasoup.createWorker({
                logLevel: 'warn',
                rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
                rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 40100,
            });

            this.worker.on('died', () => {
                console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', this.worker?.pid);
                setTimeout(() => process.exit(1), 2000);
            });

            console.log('Mediasoup Worker started');
        } catch (error) {
            console.error('Failed to create Mediasoup worker:', error);
        }
    }

    public async getRouter(roomId: string): Promise<Router> {
        if (!this.worker) throw new Error('Mediasoup worker not initialized');

        if (this.routers.has(roomId)) {
            return this.routers.get(roomId)!;
        }

        const router = await this.worker.createRouter({ mediaCodecs });
        this.routers.set(roomId, router);
        return router;
    }

    public async createWebRtcTransport(router: Router) {
        // Optimization: Explicitly undefined IPs let Mediasoup detect interface (OK for local dev)
        // For Prod: Must specify listenIps
        const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: '0.0.0.0', announcedIp }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        return {
            transport,
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            },
        };
    }
}

export const mediasoupService = new MediasoupService();

import { Device } from 'mediasoup-client';
import type { types } from 'mediasoup-client';

type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;
import socketService from './socket';

// If 'mediasoup-client/lib/types' is unreachable, we can rely on inference or manual interfaces,
// but let's try to trust the standard path or just use 'any' if the build fails again.
// Changes: explicit types for callbacks.

class MediasoupClient {
    private device: Device | null = null;
    private sendTransport: Transport | null = null;
    private recvTransport: Transport | null = null;
    private producer: Producer | null = null;
    private consumers: Map<string, Consumer> = new Map();
    private roomId: string = '';

    constructor() { }

    public async loadDevice(routerRtpCapabilities: any) {
        try {
            this.device = new Device();
            await this.device.load({ routerRtpCapabilities });
            console.log('Mediasoup device loaded');
        } catch (error) {
            console.error('Failed to load device:', error);
            if ((error as any).name === 'UnsupportedError') {
                console.warn('Browser not supported');
            }
        }
    }

    public async joinRoom(roomId: string, routerRtpCapabilities: any) {
        this.roomId = roomId;
        await this.loadDevice(routerRtpCapabilities);
        await this.initTransports();
    }

    private async initTransports() {
        if (!this.device) return;

        // Create Send Transport
        socketService.getSocket()?.emit('createWebRtcTransport', { roomId: this.roomId, direction: 'send' }, async (params: any) => {
            if (params.error) return console.error(params.error);

            this.sendTransport = this.device!.createSendTransport(params);

            this.sendTransport.on('connect', ({ dtlsParameters }: { dtlsParameters: any }, callback: () => void, _errback: (error: any) => void) => {
                socketService.getSocket()?.emit('transport-connect', { roomId: this.roomId, transportId: this.sendTransport?.id, dtlsParameters });
                callback();
            });

            this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }: { kind: string, rtpParameters: any, appData: any }, callback: (data: { id: string }) => void, errback: (error: any) => void) => {
                socketService.getSocket()?.emit('transport-produce', {
                    roomId: this.roomId,
                    transportId: this.sendTransport?.id,
                    kind,
                    rtpParameters,
                    appData
                }, (response: any) => {
                    if (response.error) errback(response.error);
                    else callback({ id: response.id });
                });
            });
        });

        // Create Recv Transport
        socketService.getSocket()?.emit('createWebRtcTransport', { roomId: this.roomId, direction: 'recv' }, async (params: any) => {
            if (params.error) return console.error(params.error);

            this.recvTransport = this.device!.createRecvTransport(params);

            this.recvTransport.on('connect', ({ dtlsParameters }: { dtlsParameters: any }, callback: () => void, _errback: (error: any) => void) => {
                socketService.getSocket()?.emit('transport-recv-connect', { roomId: this.roomId, transportId: this.recvTransport?.id, dtlsParameters });
                callback();
            });
        });
    }

    public async produceAudio(deviceId?: string): Promise<boolean> {
        if (!this.device || !this.sendTransport) {
            console.error('Device or Transport not ready');
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            const track = stream.getAudioTracks()[0];

            this.producer = await this.sendTransport.produce({ track });
            return true;
        } catch (err) {
            console.error('Produce error:', err);
            return false;
        }
    }

    public async closeProducer() {
        if (this.producer) {
            this.producer.close();
            this.producer = null;
        }
    }

    public async consume(producerId: string) {
        if (!this.device || !this.recvTransport) return;

        socketService.getSocket()?.emit('consume', {
            roomId: this.roomId,
            transportId: this.recvTransport.id,
            producerId,
            rtpCapabilities: this.device.rtpCapabilities
        }, async (params: any) => {
            if (params.error) return console.error('Consume error:', params.error);

            const consumer = await this.recvTransport!.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters,
            });

            this.consumers.set(consumer.id, consumer);

            // Resume (since we start paused)
            socketService.getSocket()?.emit('consumer-resume', { roomId: this.roomId, consumerId: consumer.id });

            // Create element to play audio
            const stream = new MediaStream([consumer.track]);
            const audio = document.createElement('audio');
            audio.srcObject = stream;
            audio.id = `audio-${consumer.id}`;
            document.body.appendChild(audio);
            audio.play().catch(e => console.error('Play error:', e));
        });
    }
}

export const mediasoupClient = new MediasoupClient();

import mongoose, { Document, Schema } from 'mongoose';

export interface IBroadcast {
    message: string;
    senderName: string;
    timestamp: Date;
}

export interface IMeeting extends Document {
    title: string;
    description: string;
    scheduledTime: Date;
    youtubeId: string;
    hostId: mongoose.Types.ObjectId;
    coHosts: string[]; // List of emails or userIds who are co-hosts
    broadcasts: IBroadcast[];
    status: 'upcoming' | 'live' | 'ended';
    createdAt: Date;
}

const MeetingSchema: Schema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    scheduledTime: { type: Date, required: true },
    youtubeId: { type: String },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coHosts: { type: [String], default: [] },
    broadcasts: [{
        message: { type: String, required: true },
        senderName: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['upcoming', 'live', 'ended'], default: 'upcoming' },
}, { timestamps: true });

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);

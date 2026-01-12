import mongoose, { Document, Schema } from 'mongoose';

export interface IPoll extends Document {
    meetingId: mongoose.Types.ObjectId;
    question: string;
    options: { text: string; votes: number }[];
    status: 'open' | 'closed';
    votedUsers: mongoose.Types.ObjectId[];
    createdAt: Date;
}

const PollSchema: Schema = new Schema({
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    question: { type: String, required: true },
    options: [{
        text: { type: String, required: true },
        votes: { type: Number, default: 0 }
    }],
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    votedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

export default mongoose.model<IPoll>('Poll', PollSchema);

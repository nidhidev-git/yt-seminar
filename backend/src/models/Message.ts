import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    meetingId: mongoose.Types.ObjectId;
    content: string;
    sentAt: Date;
}

const MessageSchema: Schema = new Schema({
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    content: { type: String, required: true },
    sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);

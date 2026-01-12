import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
    meetingId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    type: 'mic'; // Can be expanded
    grantedAt: Date;
}

const PermissionSchema: Schema = new Schema({
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['mic'], default: 'mic' },
    grantedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure unique permission per user per meeting if needed, 
// but we might want history. For active permissions, we will query by meetingId.
// Let's index for quick lookup
PermissionSchema.index({ meetingId: 1, userId: 1 });

export default mongoose.model<IPermission>('Permission', PermissionSchema);

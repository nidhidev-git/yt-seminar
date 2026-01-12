import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    googleId?: string;
    name: string;
    email: string;
    password?: string;
    avatar: string;
    role: 'admin' | 'user';
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    googleId: { type: String, unique: true, sparse: true }, // Optional now
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Hashed password for admins
    avatar: { type: String },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);

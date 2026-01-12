import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || '';
        if (!uri) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }
        // console.log(`Attempting to connect to: ${uri.substring(0, 15)}...`); 
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;

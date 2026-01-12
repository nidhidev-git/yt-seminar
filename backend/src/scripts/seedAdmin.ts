import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import connectDB from '../config/db';

dotenv.config();

const admins = [
    {
        name: 'Kuntal Ghosh',
        email: 'kuntalg2001@gmail.com',
        password: 'AdminSem@2026',
        role: 'admin',
        avatar: 'https://ui-avatars.com/api/?name=Kuntal+Ghosh&background=random'
    },
    {
        name: 'Pallab Karmakar',
        email: 'ookarmakarpallab1212@gmail.com',
        password: '', // Assuming same password unless specified otherwise, actually user didn't specify for Pallab, so using same.
        role: 'admin',
        avatar: 'https://ui-avatars.com/api/?name=Pallab+Karmakar&background=random'
    }
];

const seedAdmins = async () => {
    try {
        await connectDB();

        console.log('Seeding Admins...');

        for (const admin of admins) {
            const exists = await User.findOne({ email: admin.email });
            if (exists) {
                console.log(`Admin ${admin.email} already exists.`);
                // Update password if needed? For now, skip.
                continue;
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(admin.password, salt);

            await User.create({
                ...admin,
                password: hashedPassword
            });
            console.log(`Created Admin: ${admin.email}`);
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedAdmins();

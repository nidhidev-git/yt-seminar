import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const generateToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token (Admin)
// @route   POST /api/auth/login
// @access  Public
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && user.role === 'admin' && user.password && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id.toString()),
        });
        return;
    } else {
        res.status(401).json({ message: 'Invalid admin credentials' });
        return;
    }
};

// @desc    Join as user (Viewer)
// @route   POST /api/auth/join
// @access  Public
export const joinUser = async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body;

    // Check if user exists, if not create
    let user = await User.findOne({ email });

    if (!user) {
        user = await User.create({
            name,
            email,
            role: 'user',
            avatar: `https://ui-avatars.com/api/?name=${name}&background=random`
        });
    }

    // If user exists but is admin, deny join via this route? Or allow as viewer?
    // Let's allow but keep role. actually better to separate.

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id.toString()),
    });
};

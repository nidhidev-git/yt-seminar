import { Request, Response } from 'express';
import Meeting from '../models/Meeting';

// @desc    Create a new meeting
// @route   POST /api/meetings
// @access  Private (Admin)
export const createMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, description, youtubeId } = req.body;

        // Simple validation
        if (!title || !youtubeId) {
            res.status(400).json({ message: 'Please provide all required fields' });
            return;
        }

        const meeting = await Meeting.create({
            title,
            description,
            scheduledTime: new Date(), // Default to now
            youtubeId,
            hostId: req.user?._id || '000000000000000000000000', // Fallback if auth middleware fails or for testing
            status: 'upcoming'
        });

        res.status(201).json(meeting);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get meeting by ID
// @route   GET /api/meetings/:id
// @access  Public
export const getMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const meeting = await Meeting.findById(req.params.id).populate('hostId', 'name email');

        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        res.json(meeting);
    } catch (err: any) {
        if (err.kind === 'ObjectId') {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Public (or Private Admin)
export const getAllMeetings = async (req: Request, res: Response): Promise<void> => {
    try {
        const meetings = await Meeting.find({}).sort({ scheduledTime: 1 });
        res.json(meetings);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};
// @desc    Update a meeting
// @route   PUT /api/meetings/:id
// @access  Private (Admin)
export const updateMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, description, youtubeId, scheduledTime } = req.body;

        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        // Only host/admin can update? For now assume admin middleware handles auth
        // If we want detailed permissions:
        // if (meeting.hostId.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') ...

        meeting.title = title || meeting.title;
        meeting.description = description || meeting.description;
        meeting.youtubeId = youtubeId !== undefined ? youtubeId : meeting.youtubeId;
        meeting.scheduledTime = scheduledTime || meeting.scheduledTime;

        const updatedMeeting = await meeting.save();
        res.json(updatedMeeting);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a meeting
// @route   DELETE /api/meetings/:id
// @access  Private (Admin)
export const deleteMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        await meeting.deleteOne();
        res.json({ message: 'Meeting removed' });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

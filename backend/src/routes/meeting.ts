import express from 'express';
import { createMeeting, getMeeting, getAllMeetings, updateMeeting, deleteMeeting } from '../controllers/meeting';
import { protect, admin } from '../middleware/auth'; // We assume this exists, if not we'll create/fix it

const router = express.Router();

router.route('/')
    .post(protect, admin, createMeeting)
    .get(getAllMeetings);

router.route('/:id')
    .get(getMeeting)
    .put(protect, admin, updateMeeting)
    .delete(protect, admin, deleteMeeting);

export default router;

import express from 'express';
import { loginAdmin, joinUser } from '../controllers/auth';

const router = express.Router();

router.post('/login', loginAdmin);
router.post('/join', joinUser);

export default router;

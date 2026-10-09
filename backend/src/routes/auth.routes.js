import { Router } from 'express';
import { loginController, registerController } from '../controllers/auth.controller.js';
import { loginRateLimiter } from '../middleware/rateLimit.middleware.js';

const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginRateLimiter, loginController);

export default authRouter;

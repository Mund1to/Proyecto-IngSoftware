import { Router } from 'express';
import {
  forgotPasswordController,
  loginController,
  registerController,
  resetPasswordController,
} from '../controllers/auth.controller.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimit.middleware.js';

const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginRateLimiter, loginController);
authRouter.post('/forgot-password', passwordResetRateLimiter, forgotPasswordController);
authRouter.post('/reset-password', passwordResetRateLimiter, resetPasswordController);

export default authRouter;

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { clerkWebhook, stripeWebhooks } from './controllers/webhooks.js';
import educatorRouter from './routes/educator.routes.js';
import { clerkMiddleware } from '@clerk/express';
import connectColoudinary from './configs/cloudinary.js';
import courserRouter from './routes/course.routes.js';
import userRouter from './routes/user.routes.js';

const app = express();

await connectDB();
await connectColoudinary();

app.use(cors());

app.use(clerkMiddleware());

app.post('/clerk', express.raw({ type: 'application/json' }), clerkWebhook);
app.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhooks);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

app.use('/api/educator', educatorRouter);
app.use('/api/course', courserRouter); 
app.use('/api/user', userRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
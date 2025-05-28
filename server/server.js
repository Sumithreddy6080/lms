import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { clerkWebhook } from './controllers/webhooks.js';
import educatorRouter from './routes/educator.routes.js';
import { clerkMiddleware } from '@clerk/express';
import connectColoudinary from './configs/cloudinary.js';

const app = express();

await connectDB();
await connectColoudinary();

app.use(cors());
app.use(clerkMiddleware());

// Move webhook BEFORE express.json() for proper verification
app.post('/clerk', express.raw({ type: 'application/json' }), clerkWebhook);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Api is running');
});

app.use('/api/educator', educatorRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
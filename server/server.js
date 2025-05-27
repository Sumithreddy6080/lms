import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { clerkWebhook } from './controllers/webhooks.js';


const app = express();

await connectDB();


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Api is running');
});

app.post('/clerk',clerkWebhook);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
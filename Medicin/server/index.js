import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './routes/api.js';
import { initScheduler } from './services/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON body parser with increased limit for image uploads
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    service: 'Medicine Reminder API Engine'
  });
});

// Connect to MongoDB or run in hybrid in-memory mode
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medicine_reminder_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Database successfully.'))
  .catch((err) => console.log('⚠️ MongoDB connection deferred (Running in hybrid in-memory API mode):', err.message));

// Initialize cron scheduler
initScheduler(null);

app.listen(PORT, () => {
  console.log(`🚀 Medicine Reminder Express Backend Server active at http://localhost:${PORT}`);
});

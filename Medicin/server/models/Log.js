import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  _id: { type: String },
  userId: { type: String, required: true, default: 'user-1' },
  personId: { type: String, default: 'you' },
  medicineId: { type: String, required: true },
  medicineName: { type: String, required: true },
  dosage: { type: String },
  beforeFood: { type: Boolean },
  scheduledTime: { type: String, required: true }, // e.g., "07:30"
  actionTime: { type: String }, // e.g. "07:32"
  date: { type: String, required: true }, // YYYY-MM-DD
  timezone: { type: String, default: 'Asia/Kolkata' },
  status: { 
    type: String, 
    enum: ['taken', 'snoozed', 'skipped', 'pending', 'missed'], 
    default: 'pending' 
  },
  snoozeUntil: { type: String }
}, { timestamps: true });

export default mongoose.model('Log', logSchema);

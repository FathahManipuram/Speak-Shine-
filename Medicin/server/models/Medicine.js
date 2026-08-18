import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  _id: { type: String },
  userId: { type: String, required: true, default: 'user-1' },
  personId: { type: String, default: 'you' }, // "you", "mother", "father", "grandmother"
  personName: { type: String, default: 'You' },
  name: { type: String, required: true },
  dosage: { type: String, required: true }, // e.g. "20mg", "1 Tablet"
  beforeFood: { type: Boolean, default: true },
  startDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  endDate: { type: String },
  durationDays: { type: Number, default: 7 },
  reminderTimes: [{ type: String }], // Array of HH:mm formats e.g. ["07:30", "19:30"]
  timezone: { type: String, default: 'Asia/Kolkata' },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Medicine', medicineSchema);

import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, default: 'user-1' },
  personId: { type: String, default: 'you' },
  imageName: { type: String },
  imageData: { type: String }, // Base64 or URL
  extractedMedicines: [{
    name: String,
    dosage: String,
    beforeFood: Boolean,
    reminderTimes: [String],
    durationDays: Number,
    instructions: String
  }],
  scannedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Prescription', prescriptionSchema);

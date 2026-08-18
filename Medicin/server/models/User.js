import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Default User' },
  email: { type: String, default: 'user@example.com' },
  fcmToken: { type: String, default: 'mock-fcm-token-12345' },
  timezone: { type: String, default: 'Asia/Kolkata' }, // e.g. "Asia/Kolkata", "America/New_York", "UTC"
  familyMembers: [{
    id: String,
    name: String,
    relation: String,
    avatar: String
  }]
}, { timestamps: true });

export default mongoose.model('User', userSchema);

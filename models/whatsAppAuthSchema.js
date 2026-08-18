import mongoose from "mongoose";

const whatsAppAuthSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.WhatsAppAuth || mongoose.model("WhatsAppAuth", whatsAppAuthSchema);

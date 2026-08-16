import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    topic:    { type: String, required: true },
    question: { type: String, required: true },
    // Manual setup fields
    isManualSetup: { type: Boolean, default: false },
    setupType: { 
      type: String, 
      enum: ["regular", "weekly_reflection", "monthly_reflection", "monthly_goals", "story_summary", "picture_description"],
      default: "regular"
    },
    contentType: {
      type: String,
      enum: ["question", "story_audio", "picture_description"],
      default: "question",
    },
    audioUrl: { type: String, default: null },
    storyTranscript: { type: String, default: null },
    summaryGuide: { type: String, default: null },
    // Picture Description fields
    imageUrl:             { type: String, default: null },
    imageSource:          { type: String, default: null },
    imagePageUrl:         { type: String, default: null },
    imagePhotographer:    { type: String, default: null },
    imagePhotographerUrl: { type: String, default: null },
    imageSearchQuery:     { type: String, default: null },
    imageInstructions:    { type: String, default: null },
    imageDifficulty:      { type: String, default: null },
    speakingDuration:     { type: Number, default: null }, // seconds
    scheduledFor: { type: Date },
    scheduledTime: { type: String, default: null },
    createdBy:    { type: String },
    isUsed:       { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Enforce uniqueness at DB level — prevents duplicates even from concurrent inserts
questionSchema.index({ topic: 1 },    { unique: true, sparse: true });
questionSchema.index({ question: 1 }, { unique: true, sparse: true });

export default mongoose.model("Question", questionSchema);

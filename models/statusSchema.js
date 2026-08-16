import mongoose from "mongoose";

const statusSchema = new mongoose.Schema({
  questionSentToday: { type: Boolean, default: false },
  notifiedEmpty: { type: Boolean, default: false },
  notifiedLast: { type: Boolean, default: false },
  fineAppliedToday: { type: Boolean, default: false },
  todayTopic: { type: String, default: null },
  todayQuestion: { type: String, default: null },
  todayCategory: { type: String, default: null },
  todayContentType: { type: String, enum: ["question", "story_audio", "picture_description"], default: "question" },
  todayAudioUrl: { type: String, default: null },
  todayStoryTranscript: { type: String, default: null },
  todaySummaryGuide: { type: String, default: null },
  // Picture Description fields — populated when isPictureDescriptionDay is true
  todayImageUrl: { type: String, default: null },
  todayImageSource: { type: String, default: null },       // e.g. "Unsplash"
  todayImagePageUrl: { type: String, default: null },      // link back to source page
  todayImagePhotographer: { type: String, default: null }, // photographer name
  todayImagePhotographerUrl: { type: String, default: null },
  todayImageSearchQuery: { type: String, default: null },  // query used to find the image
  todayImageInstructions: { type: String, default: null }, // speaking instructions for the user
  todayPosterImage: { type: String, default: null },
  posterExpiresAt: { type: Date, default: null },
  recentCategories: { type: [String], default: [] },
  // Daily vocabulary words (configurable count, related to today's question)
  todayVocabulary: {
    type: [{
      word:    { type: String, required: true },
      meaning: { type: String, required: true },
      example: { type: String, required: true },
    }],
    default: [],
  },
  // Vocabulary challenge settings (admin-configurable)
  vocabWordCount: { type: Number, default: 5, min: 1, max: 10 }, // how many words shown per day
  vocabRequiredCount: { type: Number, default: 3, min: 1, max: 10 }, // how many words user must use
  vocabNormalWordCount: { type: Number, default: 5, min: 1, max: 10 },
  vocabNormalRequiredCount: { type: Number, default: 3, min: 1, max: 10 },
  vocabStoryWordCount: { type: Number, default: 5, min: 1, max: 10 },
  vocabStoryRequiredCount: { type: Number, default: 3, min: 1, max: 10 },
  vocabPictureWordCount: { type: Number, default: 5, min: 1, max: 10 },
  vocabPictureRequiredCount: { type: Number, default: 3, min: 1, max: 10 },
  vocabLevel: { type: String, default: "B2", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] }, // CEFR level
  // Story Summary settings (admin-configurable)
  storyWordCount: { type: Number, default: 200, min: 100, max: 400 },
  usedStoryThemes: { type: [String], default: [] },
  storyLevel: { type: String, default: "B1", enum: ["A2", "B1", "B2", "C1"] },
  allowPrivateVideos: { type: Boolean, default: true }, // admin can disable to force all videos public
  // Which day of the week auto-story runs (0=Sun, 1=Mon, ... 6=Sat). Default: 6 (Saturday)
  storyDay: { type: Number, default: 6, min: 0, max: 6 },
  // Which day of the week picture description runs (0=Sun ... 6=Sat). Default: 4 (Thursday). -1 = disabled.
  pictureDescriptionDay: { type: Number, default: 4, min: -1, max: 6 },
  // Payment settings (admin-configurable)
  paymentAmount: { type: Number, default: 5, min: 1, max: 100000 },
  // Duration scoring settings (admin-configurable)
  durationDefaultMax: { type: Number, default: 300, min: 60, max: 1200 },
  durationDefaultFull: { type: Number, default: 300, min: 60, max: 1200 },
  durationStoryMax: { type: Number, default: 180, min: 60, max: 1200 },
  durationStoryFull: { type: Number, default: 180, min: 60, max: 1200 },
  durationWeeklyMax: { type: Number, default: 420, min: 60, max: 1200 },
  durationWeeklyFull: { type: Number, default: 300, min: 60, max: 1200 },
  durationMonthlyReflectionMax: { type: Number, default: 420, min: 60, max: 1200 },
  durationMonthlyReflectionFull: { type: Number, default: 420, min: 60, max: 1200 },
  durationMonthlyGoalsMax: { type: Number, default: 600, min: 60, max: 1200 },
  durationMonthlyGoalsFull: { type: Number, default: 420, min: 60, max: 1200 },
  // Monthly reflection
  isMonthlyReflectionDay: { type: Boolean, default: false },
  isMonthlyGoalsDay: { type: Boolean, default: false },
  isWeeklyReflectionDay: { type: Boolean, default: false },
  isStorySummaryDay: { type: Boolean, default: false },
  isPictureDescriptionDay: { type: Boolean, default: false },
  // Duration scoring — picture description (admin-configurable)
  durationPictureMax:  { type: Number, default: 180, min: 60, max: 600 },
  durationPictureFull: { type: Number, default: 180, min: 60, max: 600 },
  // Daily report tracking
  dailyReportGenerated: { type: Boolean, default: false },
  reportExpiresAt: { type: Date, default: null },
  // Configurable schedule times (HH:MM, 24h, IST)
  posterSendTime: { type: String, default: "08:00" },
  questionGenerateTime: { type: String, default: "07:00" },
  // Track last successful daily reset (YYYY-MM-DD in IST) to detect missed resets
  lastResetDate: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model("Status", statusSchema);

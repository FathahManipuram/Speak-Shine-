/**
 * Question Scheduler Service
 * Business logic for daily question publishing
 */

import Status from "../../../models/statusSchema.js";
import Question from "../../../models/questionSchema.js";
import { generateAndInsertQuestions } from "../ai/questionGenerator.js";
import { getDueManualQuestion, getManualQuestionForDate } from "../questions/questionsService.js";
import { ensureTodayVocabulary } from "../ai/vocabularyGenerator.js";

/**
 * Sends today's poster to TARGET_GROUP on WhatsApp if connected.
 */
async function dispatchPosterToWhatsApp(details = {}) {
  try {
    if (process.env.TARGET_GROUP) {
      const { sendDailyPosterToGroup } = await import("../whatsapp/whatsappService.js");
      await sendDailyPosterToGroup(details);
    }
  } catch (err) {
    console.warn("[QuestionScheduler] WhatsApp poster auto-send skipped/failed:", err.message);
  }
}

// Monthly reflection questions — shown on the last day of every month
export const MONTHLY_REFLECTION_QUESTIONS = [
  "How many reviews did you attend this month?",
  "How many reviews passed and how many failed? Why did you fail?",
  "How many extensions did you take this month?",
  "What is your current growth and progress in the program?",
  "What did you do this month to improve your communication skill?",
  "What is your communication skill level now compared to last month?",
];
export const MONTHLY_REFLECTION_TOPIC = "Monthly Reflection";
export const MONTHLY_REFLECTION_CATEGORY = "Monthly Reflection";

// Monthly goal-setting questions — shown on the 1st of every month
export const MONTHLY_GOALS_QUESTIONS = [
  "What is your main goal for this month in the program?",
  "What is your dream or target you are working toward right now?",
  "What specific steps will you take this month to improve your communication?",
  "What was your biggest challenge last month and how will you overcome it this month?",
  "How many reviews are you planning to attend this month?",
  "What will you do differently this month to grow faster?",
];
export const MONTHLY_GOALS_TOPIC = "Monthly Goal Setting";
export const MONTHLY_GOALS_CATEGORY = "Monthly Goals";

// Weekly reflection questions — shown every Sunday
export const WEEKLY_REFLECTION_QUESTIONS = [
  "Did you attend your review this week? If yes, did you pass or fail? Why?",
  "How many days did you submit your speaking video this week?",
  "What was the best speaking moment you had this week?",
  "What was the most difficult part of speaking this week?",
  "What new word or phrase did you learn and use this week?",
  "What is your focus for next week — in both review preparation and communication?",
];
export const WEEKLY_REFLECTION_TOPIC = "Weekly Reflection";
export const WEEKLY_REFLECTION_CATEGORY = "Weekly Reflection";

export const STORY_SUMMARY_TOPIC = "Story Summary";
export const STORY_SUMMARY_CATEGORY = "Listening Practice";

/**
 * Check if today is the last day of the month (IST)
 */
function isLastDayOfMonth() {
  const now = new Date();
  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const lastDate = new Date(istDate.getFullYear(), istDate.getMonth() + 1, 0).getDate();
  return istDate.getDate() === lastDate;
}

/**
 * Check if today is the 1st of the month (IST)
 */
function isFirstDayOfMonth() {
  const now = new Date();
  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return istDate.getDate() === 1;
}

/**
 * Check if today is Sunday (IST)
 */
function isSunday() {
  const now = new Date();
  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return istDate.getDay() === 0; // 0 = Sunday
}

/**
 * Check if today is the story summary day (IST).
 * Uses storyDay from DB settings (default 6 = Saturday).
 */
async function isStoryDay() {
  try {
    const status = await Status.findOne().select("storyDay").lean();
    const configuredDay = status?.storyDay ?? 6; // default Saturday
    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return istDate.getDay() === configuredDay;
  } catch {
    // Fallback to Saturday if DB is unavailable
    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return istDate.getDay() === 6;
  }
}

/**
 * Check if today is Saturday (IST) — kept for backwards compat
 */
function isSaturday() {
  const now = new Date();
  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return istDate.getDay() === 6; // 6 = Saturday
}

/**
 * Check if today is the picture description day (IST).
 * Uses pictureDescriptionDay from DB settings (default 4 = Thursday).
 * Returns false if set to -1 (disabled).
 */
async function isPictureDescriptionDay() {
  try {
    const status = await Status.findOne().select("pictureDescriptionDay").lean();
    const configuredDay = status?.pictureDescriptionDay ?? 4;
    if (configuredDay === -1) return false;
    const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return istDate.getDay() === configuredDay;
  } catch {
    return false;
  }
}

/**
 * Auto-generate and publish a Picture Description challenge.
 * Skips with a non-fatal error if PEXELS_API_KEY is not set.
 */
async function publishAutoPictureDescription() {
  try {
    const { generatePictureDescriptionChallenge } = await import("../ai/pictureDescriptionGenerator.js");

    console.log("[QuestionScheduler] 🖼️  Auto-generating Picture Description challenge…");
    const challenge = await generatePictureDescriptionChallenge();

    await Status.updateOne({}, {
      $set: {
        questionSentToday: true,
        isPictureDescriptionDay: true,
        isStorySummaryDay: false,
        isMonthlyReflectionDay: false,
        isMonthlyGoalsDay: false,
        isWeeklyReflectionDay: false,
        todayContentType: "picture_description",
        todayTopic: challenge.title,
        todayQuestion: challenge.instructions,
        todayCategory: "Picture Description",
        todayImageUrl: challenge.imageUrl,
        todayImageSource: challenge.imageSource,
        todayImagePageUrl: challenge.imagePageUrl,
        todayImagePhotographer: challenge.imagePhotographer,
        todayImagePhotographerUrl: challenge.imagePhotographerUrl,
        todayImageSearchQuery: challenge.imageQuery,
        todayImageInstructions: challenge.instructions,
        todayAudioUrl: null,
        todayStoryTranscript: null,
        todaySummaryGuide: null,
        todayPosterImage: null,
        todayVocabulary: [],
      }
    }, { upsert: true });

    console.log(`[QuestionScheduler] ✅ Picture Description published: "${challenge.title}"`);
    await ensureTodayVocabulary().catch(err =>
      console.warn("[QuestionScheduler] Vocabulary generation failed (non-fatal):", err.message)
    );
    dispatchPosterToWhatsApp({ topic: challenge.title, question: challenge.instructions, category: "Picture Description" });
    return { published: true, type: "picture_description", topic: challenge.title, source: "auto" };
  } catch (err) {
    console.error("[QuestionScheduler] Picture Description auto-publish failed:", err.message);
    return { published: false, error: err.message };
  }
}

/**
 * Auto-generate and publish a story summary for the configured story day.
 * Skips if a manual story is already scheduled for today.
 */
export async function publishAutoSaturdayStory() {
  try {
    const { generateListeningStory } = await import("../ai/storyGenerator.js");
    const { generateAndUploadStoryAudio } = await import("../ai/storyAudioService.js");

    const status = await Status.findOne().lean();
    const wordCount = status?.storyWordCount ?? 200;
    const usedThemes = status?.usedStoryThemes || [];

    console.log("[QuestionScheduler] 🎧 Auto-generating Saturday story…");
    const story = await generateListeningStory({ wordCount, usedThemes });

    // Generate and upload audio
    const audioUrl = await generateAndUploadStoryAudio(story.story, story.topic);

    // Save used theme
    await Status.updateOne({}, { $addToSet: { usedStoryThemes: story.theme } }, { upsert: true });

    // Publish as story summary day
    await Status.updateOne({}, {
      $set: {
        questionSentToday: true,
        isStorySummaryDay: true,
        isMonthlyReflectionDay: false,
        isMonthlyGoalsDay: false,
        isWeeklyReflectionDay: false,
        todayContentType: "story_audio",
        todayTopic: story.topic,
        todayQuestion: story.question,
        todayCategory: STORY_SUMMARY_CATEGORY,
        todayAudioUrl: audioUrl,
        todayStoryTranscript: story.story,
        todaySummaryGuide: story.summaryGuide.join("\n"),
        todayPosterImage: null,
        todayVocabulary: [],
      }
    }, { upsert: true });

    console.log(`[QuestionScheduler] ✅ Saturday story published: "${story.topic}"`);
    await ensureTodayVocabulary().catch(err =>
      console.warn("[QuestionScheduler] Vocabulary generation failed (non-fatal):", err.message)
    );
    dispatchPosterToWhatsApp({ topic: story.topic, question: story.question, category: STORY_SUMMARY_CATEGORY });
    return { published: true, type: "story_summary", topic: story.topic, source: "auto" };
  } catch (err) {
    console.error("[QuestionScheduler] Saturday story auto-publish failed:", err.message);
    return { published: false, error: err.message };
  }
}

async function publishStoryQuestion(storyQuestion) {
  await Status.updateOne({}, {
    $set: {
      questionSentToday: true,
      isStorySummaryDay: true,
      isPictureDescriptionDay: false,
      isMonthlyReflectionDay: false,
      isMonthlyGoalsDay: false,
      isWeeklyReflectionDay: false,
      todayContentType: "story_audio",
      todayTopic: storyQuestion.topic || STORY_SUMMARY_TOPIC,
      todayQuestion: storyQuestion.question || "Listen to the story and record a short video summary in your own words.",
      todayCategory: storyQuestion.category || STORY_SUMMARY_CATEGORY,
      todayAudioUrl: storyQuestion.audioUrl || null,
      todayStoryTranscript: storyQuestion.storyTranscript || null,
      todaySummaryGuide: storyQuestion.summaryGuide || null,
      todayImageUrl: null,
      todayImageSource: null,
      todayImagePageUrl: null,
      todayImagePhotographer: null,
      todayImagePhotographerUrl: null,
      todayImageSearchQuery: null,
      todayImageInstructions: null,
      todayPosterImage: null,
      todayVocabulary: [],
    }
  }, { upsert: true });

  dispatchPosterToWhatsApp({
    topic: storyQuestion.topic || STORY_SUMMARY_TOPIC,
    question: storyQuestion.question,
    category: storyQuestion.category || STORY_SUMMARY_CATEGORY,
  });

  return {
    published: true,
    type: "story_summary",
    topic: storyQuestion.topic || STORY_SUMMARY_TOPIC,
    source: "manual"
  };
}

/**
 * Publish a due story summary task by exact scheduled datetime.
 * This can override the current daily question because story tasks are explicitly scheduled.
 */
export async function publishDueManualStoryQuestion(now = new Date()) {
  const storyQuestion = await getDueManualQuestion("story_summary", now);
  if (!storyQuestion) return { published: false };
  return publishStoryQuestion(storyQuestion);
}

// ── Picture Description — manual publish ─────────────────────────────────────

const PICTURE_DESCRIPTION_CATEGORY = "Picture Description";

async function publishPictureDescriptionQuestion(q) {
  await Status.updateOne({}, {
    $set: {
      questionSentToday: true,
      isPictureDescriptionDay: true,
      isStorySummaryDay: false,
      isMonthlyReflectionDay: false,
      isMonthlyGoalsDay: false,
      isWeeklyReflectionDay: false,
      todayContentType: "picture_description",
      todayTopic: q.topic,
      todayQuestion: q.question,
      todayCategory: q.category || PICTURE_DESCRIPTION_CATEGORY,
      todayImageUrl: q.imageUrl || null,
      todayImageSource: q.imageSource || null,
      todayImagePageUrl: q.imagePageUrl || null,
      todayImagePhotographer: q.imagePhotographer || null,
      todayImagePhotographerUrl: q.imagePhotographerUrl || null,
      todayImageSearchQuery: q.imageSearchQuery || null,
      todayImageInstructions: q.imageInstructions || q.question || null,
      todayAudioUrl: null,
      todayStoryTranscript: null,
      todaySummaryGuide: null,
      todayPosterImage: null,
      todayVocabulary: [],
    }
  }, { upsert: true });

  dispatchPosterToWhatsApp({
    topic: q.topic,
    question: q.question,
    category: q.category || PICTURE_DESCRIPTION_CATEGORY,
  });

  return {
    published: true,
    type: "picture_description",
    topic: q.topic,
    source: "manual",
  };
}

/**
 * Publish a due picture description task by exact scheduled datetime.
 */
export async function publishDueManualPictureDescriptionQuestion(now = new Date()) {
  const q = await getDueManualQuestion("picture_description", now);
  if (!q) return { published: false };
  return publishPictureDescriptionQuestion(q);
}

/**
 * Publish daily question
 * Handles special days (monthly reflection, goals, weekly reflection) and regular questions
 * Now checks for manual questions first before using defaults
 */
export async function publishDailyQuestion() {
  try {
    const dueStory = await publishDueManualStoryQuestion();
    if (dueStory.published) return dueStory;

    const duePicture = await publishDueManualPictureDescriptionQuestion();
    if (duePicture.published) return duePicture;

    const statusCheck = await Status.findOne();
    if (statusCheck?.questionSentToday) {
      return { alreadyPublished: true };
    }

    const today = new Date();

    // ── Story Summary Day → Auto Story Summary ────────────────────────────
    if (await isStoryDay()) {
      return await publishAutoSaturdayStory();
    }

    // ── Picture Description Day → Auto Picture Description ────────────────
    // Runs on the configured weekday (default Thursday).
    // Falls back to a normal question if generation fails (non-fatal).
    if (await isPictureDescriptionDay()) {
      const result = await publishAutoPictureDescription();
      if (result.published) return result;
      // If picture generation failed (e.g. no Pexels key), log and fall through
      // to the normal question so users still get a challenge today.
      console.warn("[QuestionScheduler] ⚠️  Picture Description failed — falling back to normal question");
    }

    // ── 1st of month → Monthly Goal Setting (takes priority over Sunday) ─
    if (isFirstDayOfMonth()) {
      // Check for manual monthly goals question first
      const manualQuestion = await getManualQuestionForDate(today, "monthly_goals");
      
      if (manualQuestion) {
        await Status.updateOne({}, {
          $set: {
            questionSentToday: true,
            isMonthlyGoalsDay: true,
            todayTopic: manualQuestion.topic,
            todayQuestion: manualQuestion.question,
            todayCategory: manualQuestion.category,
          }
        }, { upsert: true });
        
        return { 
          published: true, 
          type: "monthly_goals",
          topic: manualQuestion.topic,
          source: "manual"
        };
      }

      // Use default questions if no manual question
      const goalsText = MONTHLY_GOALS_QUESTIONS
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");
      
      await Status.updateOne({}, {
        $set: {
          questionSentToday: true,
          isMonthlyGoalsDay: true,
          todayTopic: MONTHLY_GOALS_TOPIC,
          todayQuestion: goalsText,
          todayCategory: MONTHLY_GOALS_CATEGORY,
        }
      }, { upsert: true });
      
      return { 
        published: true, 
        type: "monthly_goals",
        topic: MONTHLY_GOALS_TOPIC,
        source: "default"
      };
    }

    // ── Last day of month → Monthly Reflection (takes priority over Sunday)
    if (isLastDayOfMonth()) {
      // Check for manual monthly reflection question first
      const manualQuestion = await getManualQuestionForDate(today, "monthly_reflection");
      
      if (manualQuestion) {
        await Status.updateOne({}, {
          $set: {
            questionSentToday: true,
            isMonthlyReflectionDay: true,
            todayTopic: manualQuestion.topic,
            todayQuestion: manualQuestion.question,
            todayCategory: manualQuestion.category,
          }
        }, { upsert: true });
        
        return { 
          published: true, 
          type: "monthly_reflection",
          topic: manualQuestion.topic,
          source: "manual"
        };
      }

      // Use default questions if no manual question
      const reflectionText = MONTHLY_REFLECTION_QUESTIONS
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");
      
      await Status.updateOne({}, {
        $set: {
          questionSentToday: true,
          isMonthlyReflectionDay: true,
          todayTopic: MONTHLY_REFLECTION_TOPIC,
          todayQuestion: reflectionText,
          todayCategory: MONTHLY_REFLECTION_CATEGORY,
        }
      }, { upsert: true });
      
      return { 
        published: true, 
        type: "monthly_reflection",
        topic: MONTHLY_REFLECTION_TOPIC,
        source: "default"
      };
    }

    // ── Sunday → Weekly Reflection ────────────────────────────────────────
    if (isSunday()) {
      // Check for manual weekly reflection question first
      const manualQuestion = await getManualQuestionForDate(today, "weekly_reflection");
      
      if (manualQuestion) {
        await Status.updateOne({}, {
          $set: {
            questionSentToday: true,
            isWeeklyReflectionDay: true,
            todayTopic: manualQuestion.topic,
            todayQuestion: manualQuestion.question,
            todayCategory: manualQuestion.category,
          }
        }, { upsert: true });
        
        return { 
          published: true, 
          type: "weekly_reflection",
          topic: manualQuestion.topic,
          source: "manual"
        };
      }

      // Use default questions if no manual question
      const weeklyText = WEEKLY_REFLECTION_QUESTIONS
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");
      
      await Status.updateOne({}, {
        $set: {
          questionSentToday: true,
          isWeeklyReflectionDay: true,
          todayTopic: WEEKLY_REFLECTION_TOPIC,
          todayQuestion: weeklyText,
          todayCategory: WEEKLY_REFLECTION_CATEGORY,
        }
      }, { upsert: true });
      
      return { 
        published: true, 
        type: "weekly_reflection",
        topic: WEEKLY_REFLECTION_TOPIC,
        source: "default"
      };
    }

    // ── Regular day: pick a question from bank ────────────────────────────
    
    // Ensure question bank has questions (only regular questions, not manual setup)
    let count = await Question.countDocuments({ isManualSetup: { $ne: true } });
    if (count === 0) {
      console.log("[QuestionScheduler] Question bank empty — auto-generating 14...");
      try {
        const { totalInDb } = await generateAndInsertQuestions(14);
        count = await Question.countDocuments({ isManualSetup: { $ne: true } });
        console.log(`[QuestionScheduler] Generated questions. Total regular: ${count}`);
      } catch (err) {
        console.log("[QuestionScheduler] Auto-generate failed:", err.message);
        throw new Error("Failed to generate questions");
      }
    } else if (count <= 7) {
      // Refill in background
      generateAndInsertQuestions(14)
        .then(({ inserted }) => {
          const regularCount = inserted.filter(q => !q.isManualSetup).length;
          console.log(`[QuestionScheduler] Auto-refill: +${regularCount} regular questions`);
        })
        .catch(err => 
          console.log("[QuestionScheduler] Background refill failed:", err.message)
        );
    }

    // Pick a question avoiding recent categories (only from regular questions)
    // Keep at most (CATEGORIES - 1) recent entries so there's always ≥1 fresh category
    const ALL_CATS = 7; // Daily Life, Opinion, Personal Experience, English Growth, Future Goals, Fun Topic, Free Talk
    const MAX_RECENT = ALL_CATS - 1; // 6 — always leaves at least 1 category available

    const statusDoc = await Status.findOne();
    const recentCategories = (statusDoc?.recentCategories || []).slice(-MAX_RECENT);

    let q = null;
    if (recentCategories.length > 0) {
      const fresh = await Question.aggregate([
        { $match: { 
          category: { $nin: recentCategories },
          isManualSetup: { $ne: true }
        }},
        { $sample: { size: 1 } },
      ]);
      if (fresh?.length) q = fresh;
    }
    
    if (!q || !q.length) {
      // All categories recently used — pick the least-recently-used one
      // (oldest entry in recentCategories array, or fully random if array empty)
      const lruCategory = recentCategories.length > 0 ? recentCategories[0] : null;
      if (lruCategory) {
        const lruQ = await Question.aggregate([
          { $match: { category: lruCategory, isManualSetup: { $ne: true } }},
          { $sample: { size: 1 } },
        ]);
        if (lruQ?.length) q = lruQ;
      }
    }

    if (!q || !q.length) {
      q = await Question.aggregate([
        { $match: { isManualSetup: { $ne: true } }},
        { $sample: { size: 1 } }
      ]);
    }
    
    if (!q || !q.length) {
      throw new Error("No regular questions available");
    }

    const question = q[0];
    // Slide the window: add new category, keep only last MAX_RECENT
    const updatedRecent = question.category
      ? [...new Set([...recentCategories, question.category])].slice(-MAX_RECENT)
      : recentCategories;

    await Status.updateOne({}, {
      $set: {
        questionSentToday: true,
        todayContentType: "question",
        todayAudioUrl: null,
        todayStoryTranscript: null,
        todaySummaryGuide: null,
        todayTopic: question.topic || null,
        todayQuestion: question.question || null,
        todayCategory: question.category || null,
        recentCategories: updatedRecent,
      }
    }, { upsert: true });

    await Question.findByIdAndDelete(question._id);
    
    // Generate vocabulary words for today's question before poster dispatch
    await ensureTodayVocabulary().catch(err =>
      console.warn("[QuestionScheduler] Vocabulary generation failed (non-fatal):", err.message)
    );

    dispatchPosterToWhatsApp({
      topic: question.topic,
      question: question.question,
      category: question.category,
    });

    return { 
      published: true, 
      type: "regular",
      topic: question.topic,
      category: question.category,
      source: "generated"
    };
  } catch (err) {
    console.error("[QuestionScheduler] Error:", err.message);
    throw err;
  }
}

/**
 * Check if it's time to publish question based on configured time
 */
export async function shouldPublishQuestion() {
  try {
    const status = await Status.findOne().lean();
    if (!status) return false;

    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const nowTime = `${String(nowIST.getHours()).padStart(2, "0")}:${String(nowIST.getMinutes()).padStart(2, "0")}`;

    const sendTime = status.posterSendTime || "08:00";
    
    return nowTime === sendTime && !status.questionSentToday;
  } catch (err) {
    console.error("[QuestionScheduler] Check time error:", err.message);
    return false;
  }
}

/**
 * Catch-up: publish question if scheduled time already passed today
 */
export async function catchUpPublishQuestion() {
  try {
    const status = await Status.findOne().lean();
    if (!status || status.questionSentToday) return { catchUpNeeded: false };

    const sendTime = status.posterSendTime || "08:00";
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const nowMins = nowIST.getHours() * 60 + nowIST.getMinutes();
    const [sh, sm] = sendTime.split(":").map(Number);
    const sendMins = sh * 60 + sm;

    // If within 4-hour window after scheduled time
    if (nowMins >= sendMins && nowMins <= sendMins + 240) {
      const result = await publishDailyQuestion();
      return { catchUpNeeded: true, ...result };
    }

    return { catchUpNeeded: false };
  } catch (err) {
    console.error("[QuestionScheduler] Catch-up error:", err.message);
    throw err;
  }
}

import cron from 'node-cron';
import Medicine from '../models/Medicine.js';
import Log from '../models/Log.js';

let activeSchedulerTask = null;

export function initScheduler(wss) {
  console.log('[Scheduler] Initializing node-cron medicine reminder worker...');

  // Run every minute to check if any dose needs reminder in active user timezone
  activeSchedulerTask = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Format current time HH:mm in UTC and local ISO date
      const todayISO = now.toISOString().split('T')[0];
      
      const medicines = await Medicine.find({ active: true });

      for (const med of medicines) {
        // Calculate current local time for med's timezone
        const localTimeStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: med.timezone || 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(now);

        if (med.reminderTimes && med.reminderTimes.includes(localTimeStr)) {
          // Check if log already exists for today + this scheduled time
          const existingLog = await Log.findOne({
            medicineId: med._id.toString(),
            date: todayISO,
            scheduledTime: localTimeStr
          });

          if (!existingLog) {
            console.log(`[Scheduler Alert] 💊 Reminder triggered for ${med.name} (${med.dosage}) at ${localTimeStr} [${med.timezone}]`);
            
            const newLog = await Log.create({
              userId: med.userId,
              personId: med.personId,
              medicineId: med._id.toString(),
              medicineName: med.name,
              dosage: med.dosage,
              beforeFood: med.beforeFood,
              scheduledTime: localTimeStr,
              date: todayISO,
              timezone: med.timezone,
              status: 'pending'
            });

            // If WebSocket or Push notification system is attached, broadcast notification event
            if (wss && wss.broadcast) {
              wss.broadcast({
                type: 'PUSH_NOTIFICATION',
                payload: {
                  id: newLog._id,
                  medicineName: med.name,
                  dosage: med.dosage,
                  beforeFood: med.beforeFood,
                  scheduledTime: localTimeStr,
                  personName: med.personName || 'You',
                  dayInfo: `Day 1 of ${med.durationDays || 3}`
                }
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler Error]', err);
    }
  });

  return activeSchedulerTask;
}

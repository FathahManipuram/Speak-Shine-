import express from 'express';
import { parsePrescriptionImage } from '../services/aiVision.js';
import Medicine from '../models/Medicine.js';
import Prescription from '../models/Prescription.js';
import Log from '../models/Log.js';
import User from '../models/User.js';

const router = express.Router();

// Fallback In-Memory Storage if MongoDB is not connected
let inMemoryStore = {
  user: {
    name: 'Sidharth',
    email: 'sidharth@example.com',
    fcmToken: 'fcm-token-xyz-987',
    timezone: 'Asia/Kolkata',
    familyMembers: [
      { id: 'you', name: 'You', relation: 'Self', avatar: '👤' },
      { id: 'mother', name: 'Mother', relation: 'Mother', avatar: '👩' },
      { id: 'father', name: 'Father', relation: 'Father', avatar: '👨' },
      { id: 'grandmother', name: 'Grandmother', relation: 'Grandmother', avatar: '👵' }
    ]
  },
  medicines: [
    {
      _id: 'med-1',
      userId: 'user-1',
      personId: 'you',
      personName: 'You',
      name: 'Omeprazole',
      dosage: '20mg',
      beforeFood: true,
      startDate: new Date().toISOString().split('T')[0],
      durationDays: 3,
      reminderTimes: ['07:30', '19:30'],
      timezone: 'Asia/Kolkata',
      notes: 'Take before breakfast',
      active: true
    },
    {
      _id: 'med-2',
      userId: 'user-1',
      personId: 'you',
      personName: 'You',
      name: 'Levocet M',
      dosage: '5mg',
      beforeFood: false,
      startDate: new Date().toISOString().split('T')[0],
      durationDays: 5,
      reminderTimes: ['21:00'],
      timezone: 'Asia/Kolkata',
      notes: 'Take at night',
      active: true
    },
    {
      _id: 'med-3',
      userId: 'user-1',
      personId: 'you',
      personName: 'You',
      name: 'Mefenamic Acid',
      dosage: '500mg',
      beforeFood: false,
      startDate: new Date().toISOString().split('T')[0],
      durationDays: 2,
      reminderTimes: ['08:30'],
      timezone: 'Asia/Kolkata',
      notes: 'After breakfast for pain',
      active: true
    },
    {
      _id: 'med-4',
      userId: 'user-1',
      personId: 'you',
      personName: 'You',
      name: 'Saline Nasal Drops 10/20ml',
      dosage: '2-3 Drops (1-1-1)',
      beforeFood: false,
      startDate: new Date().toISOString().split('T')[0],
      durationDays: 2,
      reminderTimes: ['08:00', '14:00', '20:00'],
      timezone: 'Asia/Kolkata',
      notes: '3 Times Daily (Morning, Afternoon & Night)',
      active: true
    }
  ],
  logs: [
    {
      _id: 'log-1',
      userId: 'user-1',
      personId: 'you',
      medicineId: 'med-1',
      medicineName: 'Omeprazole',
      dosage: '20mg',
      beforeFood: true,
      scheduledTime: '07:30',
      actionTime: '07:32',
      date: new Date().toISOString().split('T')[0],
      timezone: 'Asia/Kolkata',
      status: 'taken'
    },
    {
      _id: 'log-2',
      userId: 'user-1',
      personId: 'you',
      medicineId: 'med-3',
      medicineName: 'Mefenamic Acid',
      dosage: '500mg',
      beforeFood: false,
      scheduledTime: '08:30',
      actionTime: null,
      date: new Date().toISOString().split('T')[0],
      timezone: 'Asia/Kolkata',
      status: 'pending'
    }
  ]
};

// Helper to check DB connectivity
const isDbConnected = () => Medicine.db && Medicine.db.readyState === 1;

// GET User Settings & Timezone
router.get('/user', async (req, res) => {
  try {
    if (isDbConnected()) {
      let user = await User.findOne({ email: 'user@example.com' });
      if (!user) {
        user = await User.create(inMemoryStore.user);
      }
      return res.json(user);
    }
    return res.json(inMemoryStore.user);
  } catch (err) {
    return res.json(inMemoryStore.user);
  }
});

// UPDATE User Timezone & Settings
router.put('/user/timezone', async (req, res) => {
  const { timezone } = req.body;
  if (!timezone) return res.status(400).json({ error: 'Timezone required' });

  try {
    inMemoryStore.user.timezone = timezone;
    // Update all medicines default timezone too
    inMemoryStore.medicines.forEach(m => m.timezone = timezone);

    if (isDbConnected()) {
      await User.updateOne({}, { timezone });
      await Medicine.updateMany({}, { timezone });
    }
    return res.json({ success: true, timezone });
  } catch (err) {
    return res.json({ success: true, timezone });
  }
});

// AI OCR PRESCRIPTION SCANNER
router.post('/prescriptions/upload', async (req, res) => {
  try {
    const { imageBase64, fileName, personId } = req.body;
    console.log(`[AI Prescription Scan] Processing photo "${fileName || 'prescription.jpg'}" for person: ${personId || 'you'}`);

    const extractedMedicines = await parsePrescriptionImage(imageBase64, fileName);

    return res.json({
      success: true,
      message: 'Prescription scanned successfully by AI Vision',
      extractedMedicines,
      scannedAt: new Date()
    });
  } catch (err) {
    console.error('Prescription OCR error:', err);
    return res.status(500).json({ error: 'Failed to process prescription image' });
  }
});

// GET ALL MEDICINES
router.get('/medicines', async (req, res) => {
  const { personId } = req.query;
  try {
    if (isDbConnected()) {
      const query = { active: true };
      if (personId) query.personId = personId;
      const meds = await Medicine.find(query);
      return res.json(meds);
    }

    let filtered = inMemoryStore.medicines.filter(m => m.active);
    if (personId) filtered = filtered.filter(m => m.personId === personId);
    return res.json(filtered);
  } catch (err) {
    let filtered = inMemoryStore.medicines.filter(m => m.active);
    if (personId) filtered = filtered.filter(m => m.personId === personId);
    return res.json(filtered);
  }
});

// CREATE MEDICINES (SAVE FROM SCAN OR MANUAL ADD)
router.post('/medicines', async (req, res) => {
  try {
    const { medicines, personId, personName, timezone } = req.body;
    const targetPersonId = personId || 'you';
    const targetPersonName = personName || 'You';
    const userTz = timezone || inMemoryStore.user.timezone || 'Asia/Kolkata';

    const newMedsList = Array.isArray(medicines) ? medicines : [medicines];
    const createdItems = [];

    for (const medData of newMedsList) {
      const item = {
        _id: 'med-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        userId: 'user-1',
        personId: targetPersonId,
        personName: targetPersonName,
        name: medData.name,
        dosage: medData.dosage || '1 Tablet',
        beforeFood: medData.beforeFood !== undefined ? medData.beforeFood : true,
        startDate: medData.startDate || new Date().toISOString().split('T')[0],
        durationDays: Number(medData.durationDays) || 7,
        reminderTimes: medData.reminderTimes && medData.reminderTimes.length > 0 ? medData.reminderTimes : ['08:00'],
        timezone: userTz,
        notes: medData.notes || medData.instructions || '',
        active: true
      };

      inMemoryStore.medicines.push(item);

      // Create today's initial pending log for this medicine
      const createdLogs = [];
      for (const timeStr of item.reminderTimes) {
        const logObj = {
          _id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          userId: 'user-1',
          personId: targetPersonId,
          medicineId: item._id,
          medicineName: item.name,
          dosage: item.dosage,
          beforeFood: item.beforeFood,
          scheduledTime: timeStr,
          actionTime: null,
          date: new Date().toISOString().split('T')[0],
          timezone: userTz,
          status: 'pending'
        };
        inMemoryStore.logs.push(logObj);
        createdLogs.push(logObj);
      }

      if (isDbConnected()) {
        try {
          const dbMed = await Medicine.create(item);
          for (const lObj of createdLogs) {
            await Log.create(lObj);
          }
          createdItems.push(dbMed);
        } catch (dbErr) {
          console.warn('[DB Sync warning]', dbErr.message);
          createdItems.push(item);
        }
      } else {
        createdItems.push(item);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Medicines saved successfully',
      medicines: createdItems
    });
  } catch (err) {
    console.error('Error adding medicines:', err);
    return res.status(500).json({ error: 'Failed to create medicines' });
  }
});

// UPDATE / EDIT MEDICINE BY ID
router.put('/medicines/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const idx = inMemoryStore.medicines.findIndex(m => m._id === id);
    if (idx !== -1) {
      inMemoryStore.medicines[idx] = {
        ...inMemoryStore.medicines[idx],
        ...updateData
      };
    }

    if (isDbConnected()) {
      await Medicine.findByIdAndUpdate(id, updateData);
    }

    return res.json({
      success: true,
      message: 'Medicine updated successfully',
      medicine: idx !== -1 ? inMemoryStore.medicines[idx] : updateData
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update medicine' });
  }
});

// DELETE MEDICINE
router.delete('/medicines/:id', async (req, res) => {
  const { id } = req.params;
  try {
    inMemoryStore.medicines = inMemoryStore.medicines.filter(m => m._id !== id);
    inMemoryStore.logs = inMemoryStore.logs.filter(l => l.medicineId !== id);

    if (isDbConnected()) {
      await Medicine.findByIdAndDelete(id);
      await Log.deleteMany({ medicineId: id });
    }

    return res.json({ success: true, message: 'Medicine deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete medicine' });
  }
});

// GET LOGS / HISTORY
router.get('/logs', async (req, res) => {
  const { date, personId } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    if (isDbConnected()) {
      const query = { date: targetDate };
      if (personId) query.personId = personId;
      const dbLogs = await Log.find(query);
      return res.json(dbLogs);
    }

    let filtered = inMemoryStore.logs.filter(l => l.date === targetDate);
    if (personId) filtered = filtered.filter(l => l.personId === personId);
    return res.json(filtered);
  } catch (err) {
    let filtered = inMemoryStore.logs.filter(l => l.date === targetDate);
    if (personId) filtered = filtered.filter(l => l.personId === personId);
    return res.json(filtered);
  }
});

// GET ALL LOGS HISTORY FOR DOCTOR REPORT
router.get('/logs/history', async (req, res) => {
  const { personId } = req.query;
  try {
    if (isDbConnected()) {
      const query = personId ? { personId } : {};
      const allLogs = await Log.find(query).sort({ createdAt: -1 });
      return res.json(allLogs);
    }

    let logs = inMemoryStore.logs;
    if (personId) logs = logs.filter(l => l.personId === personId);
    return res.json(logs);
  } catch (err) {
    return res.json(inMemoryStore.logs);
  }
});

// UPDATE LOG STATUS (Taken, Snoozed, Skipped)
router.post('/logs/status', async (req, res) => {
  const { logId, medicineId, scheduledTime, status, snoozeMinutes } = req.body;

  try {
    const todayISO = new Date().toISOString().split('T')[0];
    const actionTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let updatedLog = null;

    // Check memory store
    let existingLog = inMemoryStore.logs.find(l => 
      l._id === logId || (l.medicineId === medicineId && l.scheduledTime === scheduledTime && l.date === todayISO)
    );

    if (existingLog) {
      existingLog.status = status;
      existingLog.actionTime = actionTime;
      if (status === 'snoozed' && snoozeMinutes) {
        const snoozeDate = new Date(Date.now() + snoozeMinutes * 60000);
        existingLog.snoozeUntil = snoozeDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
      updatedLog = existingLog;
    } else {
      const med = inMemoryStore.medicines.find(m => m._id === medicineId);
      const newLog = {
        _id: 'log-' + Date.now(),
        userId: 'user-1',
        personId: med ? med.personId : 'you',
        medicineId: medicineId || 'med-1',
        medicineName: med ? med.name : 'Omeprazole',
        dosage: med ? med.dosage : '20mg',
        beforeFood: med ? med.beforeFood : true,
        scheduledTime: scheduledTime || '08:00',
        actionTime,
        date: todayISO,
        status,
        timezone: inMemoryStore.user.timezone
      };
      inMemoryStore.logs.push(newLog);
      updatedLog = newLog;
    }

    if (isDbConnected()) {
      if (logId) {
        await Log.findByIdAndUpdate(logId, { status, actionTime });
      } else {
        await Log.create(updatedLog);
      }
    }

    return res.json({
      success: true,
      message: `Status updated to ${status}`,
      log: updatedLog
    });
  } catch (err) {
    console.error('Error updating log status:', err);
    return res.status(500).json({ error: 'Failed to update log status' });
  }
});

export default router;

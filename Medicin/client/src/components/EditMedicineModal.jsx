import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Utensils, Globe, Users } from 'lucide-react';
import TimePickerInput from './TimePickerInput';

export default function EditMedicineModal({ 
  medicine, 
  onClose, 
  onSaveUpdate, 
  familyMembers, 
  userTimezone 
}) {
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    beforeFood: true,
    reminderTimes: ['08:00'],
    durationDays: 7,
    personId: 'you',
    timezone: userTimezone || 'Asia/Kolkata',
    notes: ''
  });

  useEffect(() => {
    if (medicine) {
      setFormData({
        name: medicine.name || '',
        dosage: medicine.dosage || '',
        beforeFood: medicine.beforeFood !== undefined ? medicine.beforeFood : true,
        reminderTimes: medicine.reminderTimes && medicine.reminderTimes.length > 0 ? [...medicine.reminderTimes] : ['08:00'],
        durationDays: medicine.durationDays || 7,
        personId: medicine.personId || 'you',
        timezone: medicine.timezone || userTimezone || 'Asia/Kolkata',
        notes: medicine.notes || ''
      });
    }
  }, [medicine, userTimezone]);

  if (!medicine) return null;

  const handleTimeChange = (index, value) => {
    const times = [...formData.reminderTimes];
    times[index] = value;
    setFormData({ ...formData, reminderTimes: times });
  };

  const addTimeSlot = () => {
    setFormData({
      ...formData,
      reminderTimes: [...formData.reminderTimes, '12:00']
    });
  };

  const removeTimeSlot = (index) => {
    const times = [...formData.reminderTimes];
    times.splice(index, 1);
    setFormData({ ...formData, reminderTimes: times });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const personObj = familyMembers.find(f => f.id === formData.personId) || { name: 'You' };
    onSaveUpdate(medicine._id, {
      ...formData,
      personName: personObj.name
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-slate-800 shadow-2xl relative space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Edit Medicine Details
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Medicine Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-900 text-white text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Dosage</label>
              <input
                type="text"
                required
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                className="w-full bg-slate-900 text-indigo-300 text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Food Timing</label>
              <select
                value={formData.beforeFood ? 'before' : 'after'}
                onChange={(e) => setFormData({ ...formData, beforeFood: e.target.value === 'before' })}
                className="w-full bg-slate-900 text-amber-300 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-700 outline-none"
              >
                <option value="before">Before Food / Breakfast</option>
                <option value="after">After Food / Meal</option>
              </select>
            </div>
          </div>

          {/* Reminder Times */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400">Reminder Times ({userTimezone})</label>
              <button
                type="button"
                onClick={addTimeSlot}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
              >
                + Add Time Slot
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {formData.reminderTimes.map((timeStr, idx) => (
                <TimePickerInput
                  key={idx}
                  value={timeStr}
                  onChange={(val) => handleTimeChange(idx, val)}
                  onRemove={() => removeTimeSlot(idx)}
                  canRemove={formData.reminderTimes.length > 1}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Assigned Person</label>
              <select
                value={formData.personId}
                onChange={(e) => setFormData({ ...formData, personId: e.target.value })}
                className="w-full bg-slate-900 text-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-700 outline-none"
              >
                {familyMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.avatar} {m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Timezone</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full bg-slate-900 text-slate-300 text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

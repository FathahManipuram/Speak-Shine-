import React, { useState } from 'react';
import { 
  Sparkles, UploadCloud, Camera, Image, CheckCircle2, 
  Trash2, Plus, Edit3, Save, Clock, Utensils, AlertCircle, ArrowRight
} from 'lucide-react';
import TimePickerInput from './TimePickerInput';

export default function PrescriptionScanner({ 
  onSaveExtractedMedicines, 
  userTimezone,
  familyMembers,
  selectedFamily
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedMedicines, setExtractedMedicines] = useState(null);
  const [targetPerson, setTargetPerson] = useState(selectedFamily || 'you');
  const [isSaving, setIsSaving] = useState(false);

  // Sample Demo Prescription Preset photos (Printed & Handwritten)
  const presetPhotos = [
    {
      name: 'Calicut Health Centre Prescription (4 Items).jpg',
      url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=60'
    },
    {
      name: 'Handwritten Doctor Clinic Slip.jpg',
      url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60'
    }
  ];

  // Handle Photo Selection / Upload
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      runAiScan(selected.name, url);
    }
  };

  const handleSelectPreset = (preset) => {
    setFile({ name: preset.name });
    setPreviewUrl(preset.url);
    runAiScan(preset.name, preset.url);
  };

  // Trigger AI Vision OCR Scan API
  const runAiScan = async (fileName, url) => {
    setIsScanning(true);
    setExtractedMedicines(null);

    try {
      const res = await fetch('/api/prescriptions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          imageBase64: url,
          personId: targetPerson
        })
      });
      const data = await res.json();
      
      if (data.extractedMedicines) {
        setExtractedMedicines(data.extractedMedicines);
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Editing Extracted Item
  const handleItemChange = (index, field, value) => {
    const updated = [...extractedMedicines];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedMedicines(updated);
  };

  // Handle Editing Reminder Times array
  const handleTimeChange = (itemIdx, timeIdx, value) => {
    const updated = [...extractedMedicines];
    const times = [...updated[itemIdx].reminderTimes];
    times[timeIdx] = value;
    updated[itemIdx].reminderTimes = times;
    setExtractedMedicines(updated);
  };

  const addTimeSlot = (itemIdx) => {
    const updated = [...extractedMedicines];
    updated[itemIdx].reminderTimes.push('12:00');
    setExtractedMedicines(updated);
  };

  const removeTimeSlot = (itemIdx, timeIdx) => {
    const updated = [...extractedMedicines];
    updated[itemIdx].reminderTimes.splice(timeIdx, 1);
    setExtractedMedicines(updated);
  };

  const removeMedicine = (itemIdx) => {
    const updated = [...extractedMedicines];
    updated.splice(itemIdx, 1);
    setExtractedMedicines(updated);
  };

  const addNewMedicine = () => {
    setExtractedMedicines([
      ...(extractedMedicines || []),
      {
        name: 'New Medicine',
        dosage: '1 Tablet',
        beforeFood: true,
        reminderTimes: ['08:00'],
        durationDays: 5,
        instructions: 'Take daily as prescribed'
      }
    ]);
  };

  // Final Save to MongoDB / Express API
  const handleSaveAll = async () => {
    if (!extractedMedicines || extractedMedicines.length === 0) return;
    setIsSaving(true);

    const personObj = familyMembers.find(f => f.id === targetPerson) || { name: 'You' };

    await onSaveExtractedMedicines({
      medicines: extractedMedicines,
      personId: targetPerson,
      personName: personObj.name,
      timezone: userTimezone
    });

    setIsSaving(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-indigo-500/20 shadow-xl text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          AI Optical Vision OCR Model
        </div>
        <h2 className="text-2xl font-extrabold text-white">Upload Prescription</h2>
        <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
          Upload a printed or handwritten prescription. AI automatically detects medicines, dosage, timing, and creates instant reminders.
        </p>

        {/* Target Profile Switcher */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-xs text-slate-400">Save prescription for:</span>
          <select
            value={targetPerson}
            onChange={(e) => setTargetPerson(e.target.value)}
            className="bg-indigo-950 text-indigo-200 text-xs font-bold py-1.5 px-3 rounded-xl border border-indigo-500/30 outline-none"
          >
            {familyMembers.map(m => (
              <option key={m.id} value={m.id}>{m.avatar} {m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload Zone */}
      {!previewUrl && (
        <div className="glass-card rounded-2xl p-8 text-center border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 transition">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
            <UploadCloud className="w-8 h-8" />
          </div>
          
          <h3 className="text-lg font-bold text-white mb-2">+ Upload Prescription Photo</h3>
          <p className="text-xs text-slate-400 mb-6">Supports JPG, PNG, PDF prescriptions</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition inline-flex items-center gap-2 shadow-lg shadow-indigo-600/30">
              <Camera className="w-4 h-4" />
              📷 Camera / Upload
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          {/* Quick Demo Prescriptions */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-3 font-semibold">Or try with sample prescription photos:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {presetPhotos.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl transition"
                >
                  <Image className="w-4 h-4 text-indigo-400" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Preview & AI Extraction Workflow */}
      {previewUrl && (
        <div className="space-y-6">
          
          {/* Photo Preview Banner */}
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-3">
              <img src={previewUrl} alt="Prescription" className="w-14 h-14 object-cover rounded-xl border border-slate-700" />
              <div>
                <h4 className="text-sm font-bold text-white">{file ? file.name : 'Prescription Photo'}</h4>
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Prescription Uploaded
                </p>
              </div>
            </div>

            <button
              onClick={() => { setFile(null); setPreviewUrl(null); setExtractedMedicines(null); }}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-500/20 px-3 py-1.5 rounded-lg transition"
            >
              Re-upload Photo
            </button>
          </div>

          {/* AI Scanning Loader */}
          {isScanning && (
            <div className="glass-card rounded-2xl p-12 text-center border border-amber-500/30">
              <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping"></div>
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-amber-300">AI Vision Optical Scanning...</h3>
              <p className="text-xs text-slate-400 mt-1">Reading handwriting, dosages, timings, and instructions</p>
            </div>
          )}

          {/* AI Extracted Results Editor */}
          {extractedMedicines && (
            <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    AI Extracted Medicines
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review & edit medicine names, dosage, or times before saving to your reminder schedule.
                  </p>
                </div>

                <button
                  onClick={addNewMedicine}
                  className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Medicine
                </button>
              </div>

              {/* Medicines Form Cards */}
              <div className="space-y-4">
                {extractedMedicines.map((med, idx) => (
                  <div key={idx} className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-4">
                    
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        Item #{idx + 1}
                      </span>
                      
                      <button
                        onClick={() => removeMedicine(idx)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Remove medicine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Name */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Medicine Name</label>
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full bg-slate-950 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Dosage */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                          className="w-full bg-slate-950 text-indigo-300 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Food Relation */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Food Timing</label>
                        <select
                          value={med.beforeFood ? 'before' : 'after'}
                          onChange={(e) => handleItemChange(idx, 'beforeFood', e.target.value === 'before')}
                          className="w-full bg-slate-950 text-amber-300 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none"
                        >
                          <option value="before">Before Food / Breakfast</option>
                          <option value="after">After Food / Meal</option>
                        </select>
                      </div>
                    </div>

                    {/* Reminder Times Array */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold text-slate-400">Reminder Times ({userTimezone})</label>
                        <button
                          onClick={() => addTimeSlot(idx)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                        >
                          + Add Time Slot
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        {med.reminderTimes.map((tStr, tIdx) => (
                          <TimePickerInput
                            key={tIdx}
                            value={tStr}
                            onChange={(val) => handleTimeChange(idx, tIdx, val)}
                            onRemove={() => removeTimeSlot(idx, tIdx)}
                            canRemove={med.reminderTimes.length > 1}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Course Duration (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={med.durationDays || 3}
                        onChange={(e) => handleItemChange(idx, 'durationDays', Number(e.target.value))}
                        className="w-28 bg-slate-950 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 outline-none"
                      />
                    </div>

                  </div>
                ))}
              </div>

              {/* Final Save Button */}
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-sm px-6 py-3 rounded-xl transition shadow-xl shadow-emerald-600/20 inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving to Database...' : 'Save & Set Reminders'}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}

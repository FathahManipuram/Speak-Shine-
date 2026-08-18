import React, { useState } from 'react';
import { Globe, Check, X, Compass } from 'lucide-react';

export default function TimezoneSelectorModal({ currentTz, onClose, onSelectTimezone }) {
  const [selected, setSelected] = useState(currentTz || 'Asia/Kolkata');

  const timezoneOptions = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +05:30)', city: 'New Delhi, Mumbai' },
    { value: 'America/New_York', label: 'America/New_York (EST -05:00)', city: 'New York, Toronto' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST -08:00)', city: 'Los Angeles, San Francisco' },
    { value: 'Europe/London', label: 'Europe/London (GMT +00:00)', city: 'London, Dublin' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET +01:00)', city: 'Paris, Berlin, Rome' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST +09:00)', city: 'Tokyo, Seoul' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST +10:00)', city: 'Sydney, Melbourne' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC +00:00)', city: 'Standard UTC' }
  ];

  const handleSave = () => {
    onSelectTimezone(selected);
    onClose();
  };

  const handleAutoDetect = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setSelected(detected);
      }
    } catch (e) {
      setSelected('Asia/Kolkata');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-slate-800 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            Select Your Timezone
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Reminders and daily schedule logs will calculate based on your active timezone.
        </p>

        {/* Auto Detect Button */}
        <button
          onClick={handleAutoDetect}
          className="w-full bg-slate-900 hover:bg-slate-850 border border-indigo-500/30 text-indigo-300 text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-2"
        >
          <Compass className="w-4 h-4 text-indigo-400" />
          Auto-Detect System Timezone
        </button>

        {/* Options List */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {timezoneOptions.map(option => {
            const isChecked = selected === option.value;
            return (
              <div
                key={option.value}
                onClick={() => setSelected(option.value)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  isChecked 
                    ? 'border-indigo-500 bg-indigo-950/40 text-white' 
                    : 'border-slate-800 bg-slate-900/50 hover:bg-slate-850 text-slate-300'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">{option.label}</div>
                  <div className="text-[10px] text-slate-400">{option.city}</div>
                </div>

                {isChecked && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition shadow-lg shadow-indigo-600/30"
          >
            Apply Timezone
          </button>
        </div>

      </div>
    </div>
  );
}

import React from 'react';
import { Clock, X } from 'lucide-react';

export default function TimePickerInput({ value, onChange, onRemove, canRemove = true }) {
  // Preset quick times
  const presetTimes = [
    { label: '07:30', name: '07:30 AM (Breakfast)' },
    { label: '08:30', name: '08:30 AM (Morning)' },
    { label: '14:00', name: '02:00 PM (Afternoon)' },
    { label: '19:30', name: '07:30 PM (Dinner)' },
    { label: '21:00', name: '09:00 PM (Night)' }
  ];

  return (
    <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-indigo-500/30 shadow-inner">
      <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
      
      {/* Native HTML5 Time Input with explicit dark color scheme & width */}
      <input
        type="time"
        value={value || '08:00'}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
        className="bg-slate-900 text-indigo-200 text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-indigo-400 w-32 cursor-pointer shadow-sm"
      />

      {/* Quick Select Preset Dropdown */}
      <select
        value={presetTimes.some(p => p.label === value) ? value : 'custom'}
        onChange={(e) => {
          if (e.target.value !== 'custom') onChange(e.target.value);
        }}
        className="bg-slate-900 text-slate-300 text-[11px] font-semibold py-1 px-2 rounded-lg border border-slate-700 outline-none cursor-pointer hover:bg-slate-800"
      >
        <option value="custom">Presets...</option>
        {presetTimes.map(p => (
          <option key={p.label} value={p.label}>{p.name}</option>
        ))}
      </select>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition ml-1"
          title="Remove time slot"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

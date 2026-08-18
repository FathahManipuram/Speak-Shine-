import React from 'react';
import { Pill, CheckCircle2, Clock, XCircle, BellRing, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function NotificationModal({ notification, onClose, onAction }) {
  if (!notification) return null;

  const handleAction = (status) => {
    if (status === 'taken') {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
    onAction(notification.medicineId || 'med-1', notification.medicineName, notification.dosage, notification.scheduledTime || '07:30', status);
    onClose();
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-bounce-short">
      <div className="glass-card rounded-2xl p-5 border-2 border-indigo-500/50 shadow-2xl bg-slate-900/95 space-y-4 relative overflow-hidden">
        
        {/* Glowing aura */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
            <BellRing className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>FCM PUSH NOTIFICATION</span>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Notification Card Content matching prompt spec */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          
          <div className="flex items-center gap-2 text-white font-extrabold text-sm">
            <span className="text-lg">💊</span>
            <span>Time to take your medicine</span>
          </div>

          <div className="pt-2 border-t border-slate-900">
            <h4 className="text-base font-extrabold text-indigo-300">
              {notification.medicineName || 'Omeprazole'} {notification.dosage || '20mg'}
            </h4>
            
            <p className="text-xs text-amber-300 font-medium mt-0.5">
              {notification.beforeFood ? 'Before Breakfast' : 'After Meal'}
            </p>

            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Scheduled: {notification.scheduledTime || '07:30 AM'} • {notification.dayInfo || 'Day 2 of 3'}
            </p>
          </div>

        </div>

        {/* Notification Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          
          <button
            onClick={() => handleAction('taken')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 px-2 rounded-xl transition flex flex-col items-center gap-1 shadow-lg shadow-emerald-600/30"
          >
            <CheckCircle2 className="w-4 h-4" />
            ✓ Taken
          </button>

          <button
            onClick={() => handleAction('snoozed')}
            className="bg-slate-800 hover:bg-amber-950 hover:text-amber-300 text-slate-200 font-bold text-xs py-2.5 px-2 rounded-xl border border-amber-500/30 transition flex flex-col items-center gap-1"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            ⏰ Snooze
          </button>

          <button
            onClick={() => handleAction('skipped')}
            className="bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-200 font-bold text-xs py-2.5 px-2 rounded-xl border border-rose-500/30 transition flex flex-col items-center gap-1"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            Skip
          </button>

        </div>

      </div>
    </div>
  );
}

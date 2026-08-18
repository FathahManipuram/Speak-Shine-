import React from 'react';
import { 
  CheckCircle2, Clock, XCircle, Flame, Plus, 
  Utensils, Calendar, ShieldCheck, AlertCircle, Edit3, Trash2, Globe
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function HomeDashboard({ 
  medicines, 
  logs, 
  userTimezone, 
  selectedFamily, 
  familyMembers, 
  onLogStatusChange,
  openScanTab,
  openEditModal,
  onDeleteMedicine
}) {
  const currentPerson = familyMembers.find(f => f.id === selectedFamily) || { name: 'You', avatar: '👤' };

  // Calculate greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning 👋';
    if (hour < 17) return 'Good Afternoon ☀️';
    return 'Good Evening 🌙';
  };

  // Filter medicines for selected family member
  const personMedicines = medicines.filter(m => m.personId === selectedFamily);

  // Helper to get status of a medicine reminder time for today
  const getDoseStatus = (medId, timeStr) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const foundLog = logs.find(l => 
      l.medicineId === medId && 
      l.scheduledTime === timeStr && 
      (l.date === todayStr || !l.date)
    );
    return foundLog ? foundLog.status : 'pending';
  };

  // Calculate adherence percentage for today
  const totalDosesToday = personMedicines.reduce((acc, m) => acc + (m.reminderTimes ? m.reminderTimes.length : 0), 0);
  const takenDosesToday = personMedicines.reduce((acc, m) => {
    return acc + (m.reminderTimes || []).filter(t => getDoseStatus(m._id, t) === 'taken').length;
  }, 0);

  const adherencePercent = totalDosesToday > 0 ? Math.round((takenDosesToday / totalDosesToday) * 100) : 100;

  const handleAction = (med, timeStr, status) => {
    if (status === 'taken') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 }
      });
    }
    onLogStatusChange(med._id, med.name, med.dosage, timeStr, status);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-indigo-500/20 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold tracking-wide uppercase mb-1">
              <span>{currentPerson.avatar} Profile: {currentPerson.name}</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-400 font-normal normal-case">
                <Globe className="w-3 h-3 text-indigo-400" />
                {userTimezone}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              {getGreeting()}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Today's Medicines & Scheduled Reminders
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            
            {/* Streak Counter */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Flame className="w-5 h-5 text-amber-400 fill-amber-400/20 animate-pulse" />
              <div>
                <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Streak</div>
                <div className="text-sm font-extrabold text-amber-400">4 Days 🔥</div>
              </div>
            </div>

            {/* Adherence Progress */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" className="text-slate-800" fill="transparent" />
                  <circle 
                    cx="24" cy="24" r="18" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    className="text-emerald-400 transition-all duration-700" 
                    fill="transparent"
                    strokeDasharray={113}
                    strokeDashoffset={113 - (113 * adherencePercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-emerald-400">{adherencePercent}%</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-300">Daily Progress</div>
                <div className="text-xs text-slate-400">{takenDosesToday} of {totalDosesToday} taken</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content: Today's Schedule List */}
      <div className="space-y-4">
        
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Today's Schedule
          </h3>

          <button 
            onClick={openScanTab}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Prescription
          </button>
        </div>

        {personMedicines.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center border border-dashed border-slate-800">
            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-300">No medicines scheduled for {currentPerson.name}</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Scan a prescription photo using AI OCR or add your medicines manually to set up reminders.
            </p>
            <button 
              onClick={openScanTab}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Upload Prescription Photo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {personMedicines.map(med => (
              <div key={med._id} className="space-y-2">
                {med.reminderTimes.map((timeStr, idx) => {
                  const status = getDoseStatus(med._id, timeStr);
                  
                  return (
                    <div 
                      key={`${med._id}-${timeStr}-${idx}`}
                      className={`glass-card glass-card-hover rounded-2xl p-5 border transition-all ${
                        status === 'taken' 
                          ? 'border-emerald-500/30 bg-emerald-950/10' 
                          : status === 'snoozed'
                          ? 'border-amber-500/30 bg-amber-950/10'
                          : status === 'skipped'
                          ? 'border-rose-500/30 bg-rose-950/10'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        {/* Time & Med Details */}
                        <div className="flex items-start gap-4">
                          {/* Time Badge */}
                          <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-center min-w-[85px]">
                            <div className="text-xs text-slate-400 font-medium">Time</div>
                            <div className="text-base font-extrabold text-indigo-300 font-mono">
                              {timeStr}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-white tracking-wide">
                                {med.name}
                              </h4>
                              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {med.dosage}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                                {med.beforeFood ? 'Before Food / Breakfast' : 'After Food / Meal'}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                {med.durationDays ? `${med.durationDays} Days Course` : 'Ongoing'}
                              </span>
                            </div>

                            {med.notes && (
                              <p className="text-xs text-slate-400 mt-1 italic">
                                "{med.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status & Quick Action Buttons */}
                        <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                          
                          {/* Status Badge */}
                          {status === 'taken' && (
                            <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ✓ Taken
                            </span>
                          )}

                          {status === 'snoozed' && (
                            <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold">
                              <Clock className="w-4 h-4 text-amber-400" />
                              Snoozed 10m
                            </span>
                          )}

                          {status === 'skipped' && (
                            <span className="flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold">
                              <XCircle className="w-4 h-4 text-rose-400" />
                              Skipped
                            </span>
                          )}

                          {status === 'pending' && (
                            <span className="flex items-center gap-1 bg-slate-800 text-slate-400 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Pending
                            </span>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleAction(med, timeStr, 'taken')}
                              className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1 transition ${
                                status === 'taken' 
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                                  : 'bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 border border-slate-700'
                              }`}
                              title="Mark as Taken"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Taken</span>
                            </button>

                            <button
                              onClick={() => handleAction(med, timeStr, 'snoozed')}
                              className="p-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-amber-950 hover:text-amber-300 text-slate-300 border border-slate-700 transition"
                              title="Snooze 10 Minutes"
                            >
                              <Clock className="w-4 h-4 text-amber-400" />
                              <span className="hidden sm:inline">Snooze 10m</span>
                            </button>

                            <button
                              onClick={() => handleAction(med, timeStr, 'skipped')}
                              className="p-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-700 transition"
                              title="Skip Dose"
                            >
                              <XCircle className="w-4 h-4 text-rose-400" />
                              <span className="hidden sm:inline">Skip</span>
                            </button>

                            {/* Edit Medicine Trigger */}
                            <button
                              onClick={() => openEditModal(med)}
                              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              title="Edit Medicine Details"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete Medicine */}
                            <button
                              onClick={() => onDeleteMedicine(med._id)}
                              className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                              title="Delete Medicine"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}

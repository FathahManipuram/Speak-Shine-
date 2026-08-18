import React, { useState } from 'react';
import { 
  History as HistoryIcon, Download, Calendar, CheckCircle2, 
  XCircle, Clock, ShieldCheck, FileText, User
} from 'lucide-react';

export default function HistoryView({ logs, selectedFamily, familyMembers }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const currentPerson = familyMembers.find(f => f.id === selectedFamily) || { name: 'You' };

  // Filter logs for selected person
  const personLogs = logs.filter(l => l.personId === selectedFamily || (!l.personId && selectedFamily === 'you'));

  // Group logs by date
  const grouped = personLogs.reduce((acc, log) => {
    const d = log.date || new Date().toISOString().split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(log);
    return acc;
  }, {});

  const datesList = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Export PDF / Text Medical History Report
  const handleExportReport = () => {
    const reportTitle = `MEDICIN ADHERENCE REPORT - ${currentPerson.name.toUpperCase()}\nGenerated on: ${new Date().toLocaleDateString()}\n----------------------------------------\n\n`;
    
    let reportBody = datesList.map(dateStr => {
      const dayLogs = grouped[dateStr];
      const items = dayLogs.map(l => 
        `  • ${l.medicineName} (${l.dosage}) | Scheduled: ${l.scheduledTime} | Status: ${l.status.toUpperCase()} ${l.actionTime ? `at ${l.actionTime}` : ''}`
      ).join('\n');
      return `Date: ${dateStr}\n${items}\n`;
    }).join('\n');

    if (!reportBody) reportBody = 'No log records recorded yet.';

    const blob = new Blob([reportTitle + reportBody], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Doctor_Medication_History_${currentPerson.name}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-indigo-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <HistoryIcon className="w-4 h-4" />
            Adherence History Log
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            Medication History for {currentPerson.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track taken, snoozed, and missed doses over time
          </p>
        </div>

        <button
          onClick={handleExportReport}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Report for Doctor
        </button>
      </div>

      {/* History Timeline */}
      {datesList.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No dose records yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            When reminders fire and doses are marked taken or skipped, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {datesList.map(dateStr => (
            <div key={dateStr} className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
              
              <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm border-b border-slate-800 pb-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>{new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>

              <div className="divide-y divide-slate-800/60">
                {grouped[dateStr].map(log => (
                  <div key={log._id || Math.random()} className="py-3 flex items-center justify-between">
                    
                    <div className="flex items-center gap-3">
                      {log.status === 'taken' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                      {log.status === 'snoozed' && <Clock className="w-5 h-5 text-amber-400" />}
                      {log.status === 'skipped' && <XCircle className="w-5 h-5 text-rose-400" />}
                      {log.status === 'pending' && <Clock className="w-5 h-5 text-slate-500" />}

                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {log.medicineName} <span className="text-xs font-normal text-indigo-300">({log.dosage})</span>
                        </h4>
                        
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Scheduled: {log.scheduledTime} {log.actionTime ? `• Action at ${log.actionTime}` : ''}
                        </p>
                      </div>
                    </div>

                    <div>
                      {log.status === 'taken' && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-lg">
                          ✓ Taken
                        </span>
                      )}
                      {log.status === 'snoozed' && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-lg">
                          Snoozed
                        </span>
                      )}
                      {log.status === 'skipped' && (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold px-3 py-1 rounded-lg">
                          Skipped / Missed
                        </span>
                      )}
                      {log.status === 'pending' && (
                        <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded-lg border border-slate-700">
                          Pending
                        </span>
                      )}
                    </div>

                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { Users, Plus, ShieldCheck, Heart, Pill, Clock } from 'lucide-react';

export default function FamilyMode({ 
  familyMembers, 
  selectedFamily, 
  setSelectedFamily, 
  medicines,
  onAddFamilyMember
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('Relative');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const avatars = ['👵', '👴', '👩', '👨', '🧒', '👶'];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    onAddFamilyMember({
      id: newName.toLowerCase().replace(/\s+/g, '-'),
      name: newName,
      relation: newRelation,
      avatar: randomAvatar
    });

    setNewName('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Banner */}
      <div className="glass-card rounded-2xl p-6 border border-indigo-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />
            Caregiver & Family Health Hub
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            Family Profiles & Isolated Reminders
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage separate prescriptions and push notifications for every member of your family.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Family Member
        </button>
      </div>

      {/* Add Member Form Modal */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="glass-card rounded-2xl p-5 border border-indigo-500/30 space-y-4">
          <h3 className="text-sm font-bold text-white">Add New Member to Family Health Circle</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name (e.g. Sister, Uncle)"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-slate-900 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 outline-none"
            />
            <input
              type="text"
              placeholder="Relation"
              value={newRelation}
              onChange={(e) => setNewRelation(e.target.value)}
              className="bg-slate-900 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow"
            >
              Add Profile
            </button>
          </div>
        </form>
      )}

      {/* Members Cards Grid matching prompt layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {familyMembers.map(member => {
          const isSelected = selectedFamily === member.id;
          const memberMeds = medicines.filter(m => m.personId === member.id);

          return (
            <div
              key={member.id}
              onClick={() => setSelectedFamily(member.id)}
              className={`glass-card rounded-2xl p-5 border cursor-pointer transition-all ${
                isSelected 
                  ? 'border-indigo-500 bg-indigo-950/30 glow-purple' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center text-2xl border border-slate-800">
                    {member.avatar || '👤'}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      {member.name}
                      {isSelected && (
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Active Profile
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">{member.relation}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-extrabold text-indigo-300 flex items-center gap-1 justify-end">
                    <Pill className="w-4 h-4 text-indigo-400" />
                    {memberMeds.length}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">Active Meds</div>
                </div>
              </div>

              {/* Meds Preview List */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                {memberMeds.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No medicines uploaded yet</p>
                ) : (
                  memberMeds.slice(0, 3).map(m => (
                    <div key={m._id} className="text-xs text-slate-300 flex items-center justify-between">
                      <span className="font-semibold">{m.name} ({m.dosage})</span>
                      <span className="text-[10px] font-mono text-indigo-400">{(m.reminderTimes || []).join(', ')}</span>
                    </div>
                  ))
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}

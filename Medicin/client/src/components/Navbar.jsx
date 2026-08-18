import React from 'react';
import { Pill, Bell, Globe, Users, PlusCircle, History, Home, Sparkles } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  userTimezone, 
  openTimezoneModal, 
  selectedFamily, 
  setSelectedFamily,
  familyList,
  triggerMockNotification
}) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Pill className="w-6 h-6 text-white transform -rotate-45" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
              Medicin
            </h1>
            <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">AI Prescriptions & Reminders</p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-full border border-slate-800">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'home' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Home Dashboard
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'scan' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            AI Scan Prescription
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'history' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History & Logs
          </button>

          <button
            onClick={() => setActiveTab('family')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'family' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Family Mode
          </button>
        </nav>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-2">
          
          {/* Timezone Selector Button */}
          <button 
            onClick={openTimezoneModal}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 text-xs px-3 py-1.5 rounded-full border border-indigo-500/20 transition"
            title="Change Timezone"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono font-medium hidden sm:inline">{userTimezone}</span>
          </button>

          {/* Test Push Notification Simulator Trigger */}
          <button
            onClick={triggerMockNotification}
            className="relative p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
            title="Simulate Push Notification"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
          </button>

          {/* Active Family Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="bg-indigo-950/80 text-indigo-200 text-xs font-bold py-1.5 px-3 rounded-full border border-indigo-500/30 outline-none cursor-pointer hover:bg-indigo-900 transition"
            >
              {familyList.map(member => (
                <option key={member.id} value={member.id} className="bg-slate-900 text-slate-200">
                  {member.avatar} {member.name}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>
    </header>
  );
}

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomeDashboard from './components/HomeDashboard';
import PrescriptionScanner from './components/PrescriptionScanner';
import EditMedicineModal from './components/EditMedicineModal';
import NotificationModal from './components/NotificationModal';
import HistoryView from './components/HistoryView';
import FamilyMode from './components/FamilyMode';
import TimezoneSelectorModal from './components/TimezoneSelectorModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'scan', 'history', 'family'
  const [userTimezone, setUserTimezone] = useState('Asia/Kolkata');
  const [selectedFamily, setSelectedFamily] = useState('you');
  
  const [familyMembers, setFamilyMembers] = useState([
    { id: 'you', name: 'You', relation: 'Self', avatar: '👤' },
    { id: 'mother', name: 'Mother', relation: 'Mother', avatar: '👩' },
    { id: 'father', name: 'Father', relation: 'Father', avatar: '👨' },
    { id: 'grandmother', name: 'Grandmother', relation: 'Grandmother', avatar: '👵' }
  ]);

  const [medicines, setMedicines] = useState([]);
  const [logs, setLogs] = useState([]);

  const [editingMedicine, setEditingMedicine] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);

  // Fetch initial data from Express API
  useEffect(() => {
    fetchUserData();
    fetchMedicines();
    fetchLogs();
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      if (data.timezone) setUserTimezone(data.timezone);
      if (data.familyMembers) setFamilyMembers(data.familyMembers);
    } catch (err) {
      console.warn('API sync warning:', err.message);
    }
  };

  const fetchMedicines = async () => {
    try {
      const res = await fetch('/api/medicines');
      const data = await res.json();
      if (Array.isArray(data)) setMedicines(data);
    } catch (err) {
      console.warn('API sync warning:', err.message);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) {
      console.warn('API sync warning:', err.message);
    }
  };

  // Handle Log Status Update (Taken, Snoozed, Skipped)
  const handleLogStatusChange = async (medicineId, medicineName, dosage, scheduledTime, status) => {
    try {
      const res = await fetch('/api/logs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId,
          medicineName,
          dosage,
          scheduledTime,
          status,
          snoozeMinutes: 10
        })
      });
      const data = await res.json();
      
      // Update local logs state
      if (data.log) {
        setLogs(prev => {
          const idx = prev.findIndex(l => l._id === data.log._id || (l.medicineId === medicineId && l.scheduledTime === scheduledTime));
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = data.log;
            return copy;
          }
          return [...prev, data.log];
        });
      }
    } catch (err) {
      console.error('Failed to update log:', err);
    }
  };

  // Save Medicines from AI OCR Scan
  const handleSaveExtractedMedicines = async ({ medicines: newMeds, personId, personName, timezone }) => {
    try {
      const res = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicines: newMeds,
          personId,
          personName,
          timezone
        })
      });
      const data = await res.json();

      if (data.medicines) {
        if (personId) setSelectedFamily(personId);
        await fetchMedicines();
        await fetchLogs();
        setActiveTab('home');
      }
    } catch (err) {
      console.error('Failed to save scanned medicines:', err);
    }
  };

  // Update Medicine Details (User Edit)
  const handleSaveMedicineUpdate = async (medId, updatePayload) => {
    try {
      const res = await fetch(`/api/medicines/${medId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      const data = await res.json();
      
      setMedicines(prev => prev.map(m => m._id === medId ? { ...m, ...updatePayload } : m));
    } catch (err) {
      console.error('Failed to update medicine:', err);
    }
  };

  // Delete Medicine
  const handleDeleteMedicine = async (medId) => {
    try {
      await fetch(`/api/medicines/${medId}`, { method: 'DELETE' });
      setMedicines(prev => prev.filter(m => m._id !== medId));
      setLogs(prev => prev.filter(l => l.medicineId !== medId));
    } catch (err) {
      console.error('Failed to delete medicine:', err);
    }
  };

  // Update User Timezone
  const handleSelectTimezone = async (tz) => {
    setUserTimezone(tz);
    try {
      await fetch('/api/user/timezone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz })
      });
      fetchMedicines();
    } catch (err) {
      console.error('Failed to update timezone:', err);
    }
  };

  // Trigger Mock FCM Push Notification for instant demo
  const triggerMockNotification = () => {
    const activePersonObj = familyMembers.find(f => f.id === selectedFamily) || { name: 'You' };
    const personMeds = medicines.filter(m => m.personId === selectedFamily);
    const targetMed = personMeds.length > 0 ? personMeds[0] : { name: 'Omeprazole', dosage: '20mg', beforeFood: true, reminderTimes: ['07:30'] };

    setActiveNotification({
      medicineId: targetMed._id || 'med-1',
      medicineName: targetMed.name,
      dosage: targetMed.dosage,
      beforeFood: targetMed.beforeFood,
      scheduledTime: targetMed.reminderTimes ? targetMed.reminderTimes[0] : '07:30',
      personName: activePersonObj.name,
      dayInfo: 'Day 2 of 3'
    });
  };

  // Add Family Member
  const handleAddFamilyMember = (newMember) => {
    setFamilyMembers(prev => [...prev, newMember]);
    setSelectedFamily(newMember.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userTimezone={userTimezone}
        openTimezoneModal={() => setIsTimezoneModalOpen(true)}
        selectedFamily={selectedFamily}
        setSelectedFamily={setSelectedFamily}
        familyList={familyMembers}
        triggerMockNotification={triggerMockNotification}
      />

      {/* Push Notification Overlay Banner */}
      <NotificationModal 
        notification={activeNotification}
        onClose={() => setActiveNotification(null)}
        onAction={handleLogStatusChange}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {activeTab === 'home' && (
          <HomeDashboard 
            medicines={medicines}
            logs={logs}
            userTimezone={userTimezone}
            selectedFamily={selectedFamily}
            familyMembers={familyMembers}
            onLogStatusChange={handleLogStatusChange}
            openScanTab={() => setActiveTab('scan')}
            openEditModal={(med) => setEditingMedicine(med)}
            onDeleteMedicine={handleDeleteMedicine}
          />
        )}

        {activeTab === 'scan' && (
          <PrescriptionScanner 
            onSaveExtractedMedicines={handleSaveExtractedMedicines}
            userTimezone={userTimezone}
            familyMembers={familyMembers}
            selectedFamily={selectedFamily}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView 
            logs={logs}
            selectedFamily={selectedFamily}
            familyMembers={familyMembers}
          />
        )}

        {activeTab === 'family' && (
          <FamilyMode 
            familyMembers={familyMembers}
            selectedFamily={selectedFamily}
            setSelectedFamily={setSelectedFamily}
            medicines={medicines}
            onAddFamilyMember={handleAddFamilyMember}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Medicine Reminder App (Option 4) • Powered by Express, MongoDB, Node-Cron, FCM & AI Vision OCR</p>
      </footer>

      {/* Edit Medicine Modal */}
      {editingMedicine && (
        <EditMedicineModal 
          medicine={editingMedicine}
          onClose={() => setEditingMedicine(null)}
          onSaveUpdate={handleSaveMedicineUpdate}
          familyMembers={familyMembers}
          userTimezone={userTimezone}
        />
      )}

      {/* Timezone Selector Modal */}
      {isTimezoneModalOpen && (
        <TimezoneSelectorModal 
          currentTz={userTimezone}
          onClose={() => setIsTimezoneModalOpen(false)}
          onSelectTimezone={handleSelectTimezone}
        />
      )}

    </div>
  );
}

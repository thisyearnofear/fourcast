'use client';
import { useState } from 'react';
import { UserPreferences } from '@/services/userPreferences';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export default function LocationSettings({ isOpen, onClose, isNight, currentLocationName }) {
 const [mode, setMode] = useState(UserPreferences.getLocationMode());
 const [customCity, setCustomCity] = useState(UserPreferences.getUserLocation() || '');
 const modalRef = useFocusTrap({ isOpen, onClose });

 const handleSave = () => {
 if (mode === 'manual' && customCity.trim()) {
 UserPreferences.setUserLocation(customCity.trim(), 'manual');
 } else if (mode === 'geolocation') {
 UserPreferences.setUserLocation('geolocation', 'geolocation');
 } else {
 UserPreferences.setUserLocation('random', 'random');
 }
 onClose();
 window.location.reload();
 };

 const handleModeChange = (newMode) => {
 setMode(newMode);
 if (newMode !== 'manual') {
 setCustomCity('');
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/50" onClick={onClose} />
 <div
 ref={modalRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby="location-settings-heading"
 className={`relative max-w-md w-full p-6 border border-[var(--color-rule)] bg-[var(--color-paper)]`}
 >
 <h3 id="location-settings-heading" className="text-lg font-light text-[var(--color-ink)] mb-1">Weather Location</h3>
 <p className="text-xs text-[var(--color-ink-faint)] mb-6">
 Current: {currentLocationName || 'Unknown'}
 </p>

 <div className="space-y-3 mb-6">
 <button
 onClick={() => handleModeChange('random')}
 className={`w-full text-left p-4 border transition-all ${mode === 'random' ? 'border-[var(--color-review)]/50 bg-[var(--color-review)]/10' : 'border-[var(--color-rule)] bg-[var(--color-paper-raised)] hover:bg-[var(--color-paper-soft)]'}`}
 >
 <div className="text-sm text-[var(--color-ink)] font-medium">Random</div>
 <div className="text-xs text-[var(--color-ink-faint)] mt-1">Cycle through worldwide cities automatically</div>
 </button>

 <button
 onClick={() => handleModeChange('manual')}
 className={`w-full text-left p-4 border transition-all ${mode === 'manual' ? 'border-[var(--color-review)]/50 bg-[var(--color-review)]/10' : 'border-[var(--color-rule)] bg-[var(--color-paper-raised)] hover:bg-[var(--color-paper-soft)]'}`}
 >
 <div className="text-sm text-[var(--color-ink)] font-medium">Custom City</div>
 <div className="text-xs text-[var(--color-ink-faint)] mt-1">Set your preferred location</div>
 </button>

 {mode === 'manual' && (
 <input
 type="text"
 value={customCity}
 onChange={(e) => setCustomCity(e.target.value)}
 placeholder="Enter a city name..."
 className="w-full px-4 py-2.5 bg-[var(--color-paper-soft)] border border-[var(--color-rule-strong)] text-[var(--color-ink)] text-sm placeholder-white/25 outline-none focus:border-[var(--color-review)]/50 transition-colors"
 autoFocus
 />
 )}

 <button
 onClick={() => handleModeChange('geolocation')}
 className={`w-full text-left p-4 border transition-all ${mode === 'geolocation' ? 'border-[var(--color-review)]/50 bg-[var(--color-review)]/10' : 'border-[var(--color-rule)] bg-[var(--color-paper-raised)] hover:bg-[var(--color-paper-soft)]'}`}
 >
 <div className="text-sm text-[var(--color-ink)] font-medium">Use My Location</div>
 <div className="text-xs text-[var(--color-ink-faint)] mt-1">Browser geolocation (prompts once)</div>
 </button>
 </div>

 <div className="flex gap-3">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-2 border border-[var(--color-rule)] text-[var(--color-ink-faint)] text-sm hover:text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-raised)] transition-all"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={mode === 'manual' && !customCity.trim()}
 className="flex-1 px-4 py-2 bg-[var(--color-review)]/20 border border-[var(--color-review)]/30 text-[var(--color-review)] text-sm hover:bg-[var(--color-review)]/30 transition-all disabled:opacity-30"
 >
 Save & Reload
 </button>
 </div>
 </div>
 </div>
 );
}

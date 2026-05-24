'use client';
import { useState } from 'react';
import { UserPreferences } from '@/services/userPreferences';

export default function LocationSettings({ isOpen, onClose, isNight, currentLocationName }) {
  const [mode, setMode] = useState(UserPreferences.getLocationMode());
  const [customCity, setCustomCity] = useState(UserPreferences.getUserLocation() || '');

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative max-w-md w-full rounded-2xl p-6 border border-white/10 backdrop-blur-xl bg-black/40`}>
        <h3 className="text-lg font-light text-white mb-1">Weather Location</h3>
        <p className="text-xs text-white/40 mb-6">
          Current: {currentLocationName || 'Unknown'}
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleModeChange('random')}
            className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'random' ? 'border-purple-400/50 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
          >
            <div className="text-sm text-white font-medium">Random</div>
            <div className="text-xs text-white/40 mt-1">Cycle through worldwide cities automatically</div>
          </button>

          <button
            onClick={() => handleModeChange('manual')}
            className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'manual' ? 'border-purple-400/50 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
          >
            <div className="text-sm text-white font-medium">Custom City</div>
            <div className="text-xs text-white/40 mt-1">Set your preferred location</div>
          </button>

          {mode === 'manual' && (
            <input
              type="text"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder="Enter a city name..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/25 outline-none focus:border-purple-400/50 transition-colors"
              autoFocus
            />
          )}

          <button
            onClick={() => handleModeChange('geolocation')}
            className={`w-full text-left p-4 rounded-xl border transition-all ${mode === 'geolocation' ? 'border-purple-400/50 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
          >
            <div className="text-sm text-white font-medium">Use My Location</div>
            <div className="text-xs text-white/40 mt-1">Browser geolocation (prompts once)</div>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mode === 'manual' && !customCity.trim()}
            className="flex-1 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-200 text-sm hover:bg-purple-500/30 transition-all disabled:opacity-30"
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}

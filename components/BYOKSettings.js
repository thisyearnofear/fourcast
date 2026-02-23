'use client';

import { useState, useEffect } from 'react';
import { UserPreferences } from '@/services/userPreferences';

export default function BYOKSettings() {
  const [geminiKey, setGeminiKey] = useState('');
  const [provider, setProvider] = useState('venice');
  const [byokEnabled, setByokEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Load existing preferences on mount
  useEffect(() => {
    const savedProvider = UserPreferences.getAIProvider();
    const savedKey = UserPreferences.getUserGeminiKey();
    const savedBYOK = UserPreferences.isBYOKEnabled();
    
    setProvider(savedProvider);
    setGeminiKey(savedKey || '');
    setByokEnabled(savedBYOK);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('');
    
    try {
      // Save user preferences
      if (geminiKey) {
        UserPreferences.setUserGeminiKey(geminiKey);
      }
      
      UserPreferences.setAIProvider(provider);
      UserPreferences.setBYOKEnabled(byokEnabled && !!geminiKey);
      
      setSaveStatus('Settings saved successfully!');
      
      // Clear status after 3 seconds
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('Error saving settings: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!geminiKey) {
      setSaveStatus('Please enter a Gemini API key first');
      return;
    }
    
    try {
      const response = await fetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey })
      });
      
      if (response.ok) {
        setSaveStatus('Gemini API connection successful!');
      } else {
        setSaveStatus('Gemini API connection failed. Please check your key.');
      }
    } catch (error) {
      setSaveStatus('Connection test failed: ' + error.message);
    }
  };

  return (
    <div className="byok-settings-container max-w-md mx-auto p-6 bg-gray-800 rounded-lg border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-6">AI Provider Settings</h2>
      
      {/* Provider Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">AI Provider</h3>
        <div className="space-y-3">
          <label className="flex items-center p-3 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors">
            <input
              type="radio"
              name="ai-provider"
              value="venice"
              checked={provider === 'venice'}
              onChange={(e) => setProvider(e.target.value)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-white">Venice AI</span>
              <span className="block text-xs text-gray-400">Default - Uses your existing credits</span>
            </div>
          </label>
          
          <label className={`flex items-center p-3 bg-gray-700 rounded-lg border transition-colors ${
            byokEnabled && geminiKey 
              ? 'border-gray-600 hover:border-gray-500' 
              : 'border-gray-700 opacity-60'
          }`}>
            <input
              type="radio"
              name="ai-provider"
              value="gemini"
              checked={provider === 'gemini'}
              onChange={(e) => setProvider(e.target.value)}
              disabled={!byokEnabled || !geminiKey}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-white">Gemini 3</span>
              <span className="block text-xs text-gray-400">
                {byokEnabled && geminiKey 
                  ? 'BYOK - Bring Your Own Key' 
                  : 'Enable BYOK below to use Gemini 3'
                }
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* BYOK Configuration */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-200">BYOK Configuration</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={byokEnabled}
              onChange={(e) => setByokEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-300">
              Enable BYOK
            </span>
          </label>
        </div>
        
        {byokEnabled && (
          <div className="space-y-4 p-4 bg-gray-700 rounded-lg">
            <div>
              <label htmlFor="gemini-key" className="block text-sm font-medium text-gray-300 mb-2">
                Gemini API Key
              </label>
              <input
                type="password"
                id="gemini-key"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-gray-400">
                Your API key is stored locally and never sent to our servers
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={!geminiKey || isSaving}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Test Connection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Status Message */}
      {saveStatus && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          saveStatus.includes('successful') || saveStatus.includes('success')
            ? 'bg-green-900/30 text-green-400 border border-green-800'
            : saveStatus.includes('Error') || saveStatus.includes('failed') || saveStatus.includes('failed')
            ? 'bg-red-900/30 text-red-400 border border-red-800'
            : 'bg-blue-900/30 text-blue-400 border border-blue-800'
        }`}>
          {saveStatus}
        </div>
      )}

      {/* Hackathon Demo Note */}
      <div className="mt-6 p-4 bg-purple-900/20 border border-purple-800 rounded-lg">
        <h4 className="text-sm font-semibold text-purple-300 mb-2">🚀 Hackathon Demo</h4>
        <p className="text-xs text-purple-200">
          This BYOK feature allows judges to see Gemini 3 integration while maintaining 
          your Venice AI credits as the reliable default. Perfect for showcasing 
          enterprise-ready AI provider flexibility!
        </p>
      </div>
    </div>
  );
}
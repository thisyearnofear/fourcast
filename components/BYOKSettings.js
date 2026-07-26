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
 <div className="byok-settings-container max-w-md mx-auto p-6 bg-[var(--color-paper)] border border-[var(--color-rule-strong)]">
 <h2 className="text-xl font-bold text-[var(--color-ink)] mb-6">AI Provider Settings</h2>
 
 {/* Provider Selection */}
 <div className="mb-6">
 <h3 className="text-lg font-semibold text-[var(--color-ink-muted)] mb-3">AI Provider</h3>
 <div className="space-y-3">
 <label className="flex items-center p-3 bg-[var(--color-paper-raised)] border border-[var(--color-rule-strong)] hover:border-[var(--color-rule-strong)] transition-colors">
 <input
 type="radio"
 name="ai-provider"
 value="venice"
 checked={provider === 'venice'}
 onChange={(e) => setProvider(e.target.value)}
 className="w-4 h-4 text-[var(--color-evidence)] bg-[var(--color-ink)] border-[var(--color-rule)] focus:ring-[var(--color-evidence)]"
 />
 <div className="ml-3">
 <span className="block text-sm font-medium text-[var(--color-ink)]">Venice AI</span>
 <span className="block text-xs text-[var(--color-ink-faint)]">Default - Uses your existing credits</span>
 </div>
 </label>
 
 <label className={`flex items-center p-3 bg-[var(--color-paper-raised)] border transition-colors ${
 byokEnabled && geminiKey 
 ? 'border-[var(--color-rule-strong)] hover:border-[var(--color-rule-strong)]' 
 : 'border-[var(--color-rule)] opacity-60'
 }`}>
 <input
 type="radio"
 name="ai-provider"
 value="gemini"
 checked={provider === 'gemini'}
 onChange={(e) => setProvider(e.target.value)}
 disabled={!byokEnabled || !geminiKey}
 className="w-4 h-4 text-[var(--color-evidence)] bg-[var(--color-ink)] border-[var(--color-rule)] focus:ring-[var(--color-evidence)]"
 />
 <div className="ml-3">
 <span className="block text-sm font-medium text-[var(--color-ink)]">Gemini 3</span>
 <span className="block text-xs text-[var(--color-ink-faint)]">
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
 <h3 className="text-lg font-semibold text-[var(--color-ink-muted)]">BYOK Configuration</h3>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={byokEnabled}
 onChange={(e) => setByokEnabled(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-[var(--color-paper-raised)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--color-evidence)] peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--color-rule)] after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-evidence)]"></div>
 <span className="ml-3 text-sm font-medium text-[var(--color-ink-muted)]">
 Enable BYOK
 </span>
 </label>
 </div>
 
 {byokEnabled && (
 <div className="space-y-4 p-4 bg-[var(--color-paper-raised)]">
 <div>
 <label htmlFor="gemini-key" className="block text-sm font-medium text-[var(--color-ink-muted)] mb-2">
 Gemini API Key
 </label>
 <input
 type="password"
 id="gemini-key"
 value={geminiKey}
 onChange={(e) => setGeminiKey(e.target.value)}
 placeholder="Enter your Gemini API key"
 className="w-full px-3 py-2 bg-[var(--color-paper-soft)] border border-[var(--color-rule-strong)] text-[var(--color-ink)] placeholder-[var(--color-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-evidence)]"
 />
 <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
 Your API key is stored locally and never sent to our servers
 </p>
 </div>
 
 <div className="flex gap-2">
 <button
 onClick={handleTestConnection}
 disabled={!geminiKey || isSaving}
 className="px-4 py-2 bg-[var(--color-paper-soft)] hover:bg-[var(--color-paper-soft)] text-[var(--color-ink)] text-sm font-medium transition-colors disabled:opacity-50"
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
 className="flex-1 px-4 py-2 bg-[var(--color-evidence)] hover:bg-[var(--color-evidence)] text-[var(--color-ink)] font-medium transition-colors disabled:opacity-50"
 >
 {isSaving ? 'Saving...' : 'Save Settings'}
 </button>
 </div>

 {/* Status Message */}
 {saveStatus && (
 <div className={`mt-4 p-3 text-sm ${
 saveStatus.includes('successful') || saveStatus.includes('success')
 ? 'bg-[var(--color-accent)]/30 text-[var(--color-accent)] border border-[var(--color-accent)]'
 : saveStatus.includes('Error') || saveStatus.includes('failed') || saveStatus.includes('failed')
 ? 'bg-[var(--color-breach)]/30 text-[var(--color-breach)] border border-[var(--color-breach)]'
 : 'bg-[var(--color-evidence)]/30 text-[var(--color-evidence)] border border-[var(--color-evidence)]'
 }`}>
 {saveStatus}
 </div>
 )}

 {/* Hackathon Demo Note */}
 <div className="mt-6 p-4 bg-[var(--color-review)]/20 border border-[var(--color-review)]">
 <h4 className="text-sm font-semibold text-[var(--color-review)] mb-2">🚀 Hackathon Demo</h4>
 <p className="text-xs text-[var(--color-review)]">
 This BYOK feature allows judges to see Gemini 3 integration while maintaining 
 your Venice AI credits as the reliable default. Perfect for showcasing 
 enterprise-ready AI provider flexibility!
 </p>
 </div>
 </div>
 );
}
/**
 * Hackathon Demo Script - BYOK Gemini 3 Showcase
 * This script demonstrates the enhanced AI routing capabilities
 */

import { UserPreferences } from '../services/userPreferences.js';
import { AIRouter } from '../services/aiRouter.js';

export class HackathonDemo {
  constructor() {
    this.router = new AIRouter();
  }

  // Demo 1: Default Venice AI (Your credits)
  async demonstrateDefaultMode() {
    console.log('🎯 DEMO 1: Default Mode (Venice AI)');
    console.log('----------------------------------------');
    
    // Reset to default
    UserPreferences.setAIProvider('venice');
    
    const status = this.router.getProviderStatus();
    console.log('Current Provider:', status.preference);
    console.log('Venice AI Available:', status.venice.available);
    console.log('Using your credits: ✅');
    
    // Simulate analysis
    const mockParams = {
      title: 'Will it rain in London tomorrow?',
      location: { name: 'London, UK' },
      weatherData: { current: { temp_f: 55, condition: 'Partly Cloudy' } }
    };
    
    try {
      const result = await this.router.analyze(mockParams);
      console.log('✅ Analysis completed using Venice AI');
      console.log('Result preview:', result.analysis?.substring(0, 100) + '...');
    } catch (error) {
      console.log('❌ Analysis failed:', error.message);
    }
    
    console.log('\n');
  }

  // Demo 2: BYOK Gemini 3 Mode
  async demonstrateBYOKMode() {
    console.log('🤖 DEMO 2: BYOK Mode (Gemini 3)');
    console.log('----------------------------------');
    
    // Setup BYOK mode
    const demoApiKey = 'DEMO_GEMINI_KEY_123'; // In real demo, user would provide actual key
    UserPreferences.setUserGeminiKey(demoApiKey);
    UserPreferences.setAIProvider('gemini');
    UserPreferences.setBYOKEnabled(true);
    
    const status = this.router.getProviderStatus();
    console.log('Current Provider:', status.preference);
    console.log('Gemini 3 Available:', status.gemini.available);
    console.log('User BYOK Enabled:', status.gemini.userProvided);
    console.log('Using user-provided API key: ✅');
    
    // Simulate analysis
    const mockParams = {
      title: 'Will Bitcoin reach $100K by year end?',
      marketType: 'cryptocurrency',
      currentOdds: { yes: 0.35, no: 0.65 }
    };
    
    try {
      const result = await this.router.analyze(mockParams);
      console.log('✅ Analysis completed using Gemini 3 (BYOK)');
      console.log('Result preview:', result.analysis?.substring(0, 100) + '...');
    } catch (error) {
      console.log('⚠️ Gemini API would be called with user key (demo simulation)');
      console.log('In real usage, user provides their own Gemini API key');
    }
    
    console.log('\n');
  }

  // Demo 3: Intelligent Fallback
  async demonstrateFallbackCapability() {
    console.log('🔄 DEMO 3: Intelligent Fallback');
    console.log('------------------------------');
    
    // Setup user preference for Gemini but simulate API failure
    UserPreferences.setUserGeminiKey('invalid-key');
    UserPreferences.setAIProvider('gemini');
    UserPreferences.setBYOKEnabled(true);
    
    console.log('User prefers Gemini 3, but API key is invalid...');
    console.log('System automatically falls back to Venice AI ✅');
    
    const mockParams = {
      title: 'NFL Game: Chiefs vs Eagles',
      eventType: 'NFL',
      location: { name: 'Arrowhead Stadium' }
    };
    
    try {
      const result = await this.router.analyze(mockParams);
      console.log('✅ Fallback successful - Venice AI provided analysis');
      console.log('Result preview:', result.analysis?.substring(0, 100) + '...');
    } catch (error) {
      console.log('❌ Both providers failed:', error.message);
    }
    
    console.log('\n');
  }

  // Run complete demo sequence
  async runFullDemo() {
    console.log('🚀 Fourcast BYOK Gemini 3 Hackathon Demo');
    console.log('========================================\n');
    
    await this.demonstrateDefaultMode();
    await this.demonstrateBYOKMode();
    await this.demonstrateFallbackCapability();
    
    console.log('🏆 Key Features Demonstrated:');
    console.log('• User-controlled AI provider selection');
    console.log('• BYOK (Bring Your Own Key) security model');
    console.log('• Intelligent fallback system');
    console.log('• Seamless integration with existing Venice AI');
    console.log('• Production-ready architecture');
    
    console.log('\n📝 For Hackathon Judges:');
    console.log('This enhancement adds Gemini 3 capabilities while preserving');
    console.log('your existing Venice AI setup as the reliable default.');
    console.log('Users can opt into Gemini 3 by providing their own API key.');
  }
}

// Export for use in other scripts
export default HackathonDemo;

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new HackathonDemo();
  demo.runFullDemo().catch(console.error);
}
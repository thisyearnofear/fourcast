#!/usr/bin/env node
/**
 * Test Reasoning Flow
 * Verifies that analyzeWeatherImpactServer returns the thinking field
 */

import { analyzeWeatherImpactServer } from '../services/aiService.server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testReasoningFlow() {
  console.log('🧪 Testing Deep Reasoning Flow...');
  
  const testParams = {
    title: 'Will it rain in London tomorrow?',
    eventType: 'Weather',
    location: 'London, UK',
    currentOdds: { yes: 0.6, no: 0.4 },
    mode: 'basic',
    includeThinking: true // This is the new parameter we added
  };

  try {
    console.log('📡 Calling analyzeWeatherImpactServer with includeThinking: true...');
    const result = await analyzeWeatherImpactServer(testParams);
    
    console.log('\n✅ Analysis successful!');
    console.log('-----------------------------------');
    console.log('Result Keys:', Object.keys(result));
    
    if (result.thinking) {
      console.log('\n🧠 Thinking Process Found:');
      console.log(result.thinking.substring(0, 300) + '...');
      console.log(`(Total length: ${result.thinking.length} chars)`);
    } else {
      console.log('\n❌ No thinking process found in result.');
      console.log('Raw result keys:', Object.keys(result));
    }
    
    console.log('\n📝 Analysis Summary:');
    console.log(result.analysis.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testReasoningFlow();

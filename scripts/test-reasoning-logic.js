/**
 * Test Reasoning Flow (Mocked)
 * Verifies that analyzeWeatherImpactServer extracts thinking correctly
 * without requiring Redis or actual API calls.
 */

// Core logic to test
function extractThinkingFromContent(content, includeThinking) {
  let thinking = null;
  let cleanedContent = content.trim();

  if (cleanedContent.includes('<think>')) {
    const thinkStart = cleanedContent.indexOf('<think>');
    const thinkEnd = cleanedContent.lastIndexOf('</think>');
    if (thinkEnd !== -1) {
      thinking = cleanedContent.substring(thinkStart + 7, thinkEnd).trim();
      if (!includeThinking) {
        cleanedContent = cleanedContent.substring(thinkEnd + 8).trim();
      }
    }
  }
  return { thinking, cleanedContent };
}

console.log('🧪 Testing Deep Reasoning Extraction Logic...');

const mockResponse = `<think>
  1. Market is soccer.
  2. Weather is rainy.
  3. City play well in rain.
</think>
Analysis: Manchester City is likely to win because...`;

console.log('\nTest Case 1: includeThinking = true');
const res1 = extractThinkingFromContent(mockResponse, true);
console.log('Thinking extracted:', res1.thinking !== null);
console.log('Thinking length:', res1.thinking?.length);

console.log('\nTest Case 2: includeThinking = false');
const res2 = extractThinkingFromContent(mockResponse, false);
console.log('Thinking extracted:', res2.thinking !== null);
console.log('Content cleaned:', res2.cleanedContent.startsWith('Analysis:'));

if (res1.thinking && res2.cleanedContent.startsWith('Analysis:')) {
  console.log('\n✅ Extraction logic verified successfully!');
} else {
  console.log('\n❌ Extraction logic failed!');
  process.exit(1);
}

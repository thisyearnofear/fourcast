2. Wait for markets to load

**Expected:**
- [ ] Markets list displays
- [ ] No console errors
- [ ] Events show with odds

#### Test 5: Analyze a Market
1. Click on any market (e.g., "Will Randers FC win on 2025-11-24?")
2. Click "Analyze" button
3. Wait for analysis to complete

**Expected:**
- [ ] Loading indicator appears
- [ ] Analysis completes within 5-10 seconds
- [ ] No 400 errors in console
- [ ] Weather conditions display
- [ ] AI reasoning displays
- [ ] Key factors list displays
- [ ] Recommended action displays

#### Test 6: Test Cross-Platform Functionality
1. Go to Discovery tab
2. Use platform filter to switch between Polymarket and Kalshi
3. Verify platform badges appear correctly
4. Check volume formatting adapts (Polymarket = $XK, Kalshi = X Vol)

**Expected:**
- [ ] Platform badges show correctly (blue for Polymarket, green for Kalshi)
- [ ] Volume formatting adapts to platform
- [ ] Filtering works properly

## Key Takeaways

### ✅ DO:
- Use `llama-3.3-70b` for JSON responses
- Use `enable_web_search: "auto"` (string)
- Use prompt engineering for JSON output
- Parse responses defensively
- Implement progressive enhancement for signal publishing
- Use platform-specific UI elements for multi-platform support

### ❌ DON'T:
- Use `response_format` (not supported)
- Use `enable_web_search: true` (boolean)
- Use invalid parameters
- Use `qwen3-235b` for JSON (thinking tags)
- Assume synchronous on-chain publishing - use SQLite for immediate feedback
- Ignore platform-specific data formats

## Support

If you encounter issues:
1. Check `VENICE_API_KEY` in `.env.local`
2. Run `node scripts/test-fixed-venice.js`
3. Verify using `llama-3.3-70b` model
4. Ensure `enable_web_search: "auto"` (string)
5. Check console logs for specific errors
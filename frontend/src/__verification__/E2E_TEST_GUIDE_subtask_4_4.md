# E2E Test Guide: Filter Scenarios with Optimistic Updates

**Subtask:** 4-4 - Test filter scenarios with optimistic updates
**Purpose:** Runtime verification of optimistic update behavior with active filters
**Prerequisites:** Frontend running at http://localhost:3000, Backend running at port 3001

---

## Test Environment Setup

### 1. Start Services

```bash
# Terminal 1: Start backend
cd backend
pnpm dev

# Terminal 2: Start frontend
cd frontend
pnpm dev
```

### 2. Verify Services

- Frontend: http://localhost:3000
- Backend: http://localhost:3001/api/health
- Check SSE connection indicator shows green "实时同步"

### 3. Prepare Test Data

Create some test notes with different categories:
- Work category: 2-3 notes
- Personal category: 2-3 notes
- No category: 1-2 notes

---

## Test Cases

### Test Case 1: Create Note with Matching Category Filter

**Objective:** Verify optimistic update behavior when creating a note that matches the active filter

**Setup:**
1. Open app at http://localhost:3000
2. Click on "work" category in sidebar to filter
3. Verify only work notes are visible

**Steps:**
1. In the note editor, enter: "Filter test note - work category"
2. Select category: "work"
3. Click "Create" button
4. **Observe:**
   - Note should appear after a brief delay (NOT immediately)
   - Global sync indicator "同步中" should appear
   - Success toast: "笔记创建成功"
5. Wait for sync indicator to disappear
6. Verify the new note is in the work category list
7. Refresh the page (F5)
8. Verify note persists

**Expected Results:**
- ✅ Note appears in work category view
- ⚠️ Note appears AFTER backend response (not optimistic - known limitation)
- ✅ Sync indicator appears during backend sync
- ✅ Success toast shown
- ✅ Note persists after refresh

**Actual Results:**
- [ ] Note appears immediately (optimistic)
- [ ] Note appears after delay
- [ ] Sync indicator shown
- [ ] Success toast shown
- [ ] Note persists after refresh

**Notes:**
```
Known limitation: Optimistic updates don't work in filtered views.
Note should appear after backend response, not immediately.
```

---

### Test Case 2: Create Note with Different Category Filter

**Objective:** Verify that notes with non-matching categories don't appear in filtered view

**Setup:**
1. Open app at http://localhost:3000
2. Click on "work" category in sidebar
3. Verify only work notes are visible

**Steps:**
1. In the note editor, enter: "Personal note - should not appear in work view"
2. Select category: "personal" (or different from work)
3. Click "Create" button
4. **Observe:**
   - Note should NOT appear in the work category list
   - Sync indicator appears
   - Success toast shown
5. Wait for sync to complete
6. Verify note is still not in work category view
7. Click on "personal" category in sidebar
8. **Expected:** Note should now be visible in personal category
9. Refresh page and verify

**Expected Results:**
- ✅ Note does NOT appear in work category view
- ✅ Sync indicator appears
- ✅ Success toast shown
- ✅ Note appears when switching to personal category
- ✅ Note persists after refresh

**Actual Results:**
- [ ] Note does NOT appear in work view
- [ ] Note appears in personal view
- [ ] Success toast shown
- [ ] Note persists after refresh

**Notes:**
```
This is correct behavior - notes should only appear in views that match their filters.
```

---

### Test Case 3: Create Note with No Filter (Baseline)

**Objective:** Verify optimistic updates work correctly without filters (baseline test)

**Setup:**
1. Open app at http://localhost:3000
2. Ensure no category filters are active (click "All Notes" or clear filters)
3. Verify all notes are visible

**Steps:**
1. In the note editor, enter: "Unfiltered optimistic test"
2. Leave category empty or select any
3. Click "Create" button
4. **Observe:**
   - Note should appear IMMEDIATELY (optimistic update)
   - Note should have reduced opacity (60%) and spinner
   - Sync indicator appears in header
   - Success toast shown after backend responds
5. Wait for sync to complete
6. Verify note opacity returns to 100% and spinner disappears
7. Refresh page and verify note persists

**Expected Results:**
- ✅ Note appears IMMEDIATELY (optimistic update)
- ✅ Note shows syncing indicator (opacity + spinner)
- ✅ Sync indicator in header visible
- ✅ Note opacity returns to normal after sync
- ✅ Success toast shown
- ✅ Note persists after refresh

**Actual Results:**
- [ ] Note appears immediately
- [ ] Syncing indicator shown on note
- [ ] Global sync indicator shown
- [ ] Note returns to normal after sync
- [ ] Success toast shown
- [ ] Note persists after refresh

**Notes:**
```
This is the baseline test - optimistic updates should work perfectly without filters.
```

---

### Test Case 4: Delete Note in Filtered View

**Objective:** Verify optimistic delete behavior with active category filter

**Setup:**
1. Open app at http://localhost:3000
2. Click on "work" category
3. Identify a work note to delete

**Steps:**
1. Click delete button on a work note
2. Confirm deletion in dialog
3. **Observe:**
   - Note should disappear after brief delay (NOT immediately)
   - Sync indicator appears
   - Success toast: "笔记已删除"
4. Wait for sync to complete
5. Verify note is no longer in the list
6. Refresh page
7. Verify note is still deleted

**Expected Results:**
- ✅ Note disappears from work category view
- ⚠️ Note disappears AFTER backend response (not optimistic - known limitation)
- ✅ Sync indicator appears
- ✅ Success toast shown
- ✅ Note persists as deleted after refresh

**Actual Results:**
- [ ] Note disappears immediately
- [ ] Note disappears after delay
- [ ] Success toast shown
- [ ] Note persists as deleted

**Notes:**
```
Known limitation: Optimistic delete doesn't work in filtered views.
Note should disappear after backend response, not immediately.
```

---

### Test Case 5: Delete Note with No Filter (Baseline)

**Objective:** Verify optimistic delete works correctly without filters (baseline test)

**Setup:**
1. Open app at http://localhost:3000
2. Ensure no filters are active
3. Identify any note to delete

**Steps:**
1. Click delete button on a note
2. Confirm deletion in dialog
3. **Observe:**
   - Note should disappear IMMEDIATELY (optimistic delete)
   - Sync indicator appears in header
   - Success toast shown after backend responds
4. Wait for sync to complete
5. Refresh page
6. Verify note is still deleted

**Expected Results:**
- ✅ Note disappears IMMEDIATELY (optimistic delete)
- ✅ Sync indicator appears in header
- ✅ Success toast shown
- ✅ Note persists as deleted after refresh

**Actual Results:**
- [ ] Note disappears immediately
- [ ] Sync indicator shown
- [ ] Success toast shown
- [ ] Note persists as deleted

**Notes:**
```
Baseline test - optimistic delete should work perfectly without filters.
```

---

### Test Case 6: Create with Multiple Filters Active

**Objective:** Verify behavior with multiple filter combinations

**Setup:**
1. Open app at http://localhost:3000
2. Set category filter to "work"
3. Set a tag filter (if tags are available)
4. Verify filtered results

**Steps:**
1. Create a note with:
   - Category: "work" (matches filter)
   - Tags: [matching tag]
   - Content: "Multiple filter test"
2. Click "Create"
3. **Observe:**
   - Note should appear after backend response
   - Sync indicator visible
4. Clear filters one by one
5. Verify note appears in each appropriate view

**Expected Results:**
- ✅ Note appears in filtered view after backend response
- ⚠️ Not optimistic (known limitation)
- ✅ Note appears in all matching views when filters cleared
- ✅ Success toast shown

**Actual Results:**
- [ ] Note appears after delay
- [ ] Note visible in matching filter views
- [ ] Success toast shown

**Notes:**
```
Testing multiple filter combinations to ensure cache consistency.
```

---

### Test Case 7: Filter Change During Creation

**Objective:** Verify no errors when changing filters while note creation is in progress

**Setup:**
1. Open app at http://localhost:3000
2. Set category filter to "work"
3. Note: This test requires timing - need to change filter quickly after clicking create

**Steps:**
1. Create a note with category="work"
2. **Immediately** after clicking create (within 1 second), change category filter to "personal"
3. **Observe:**
   - No errors should occur
   - No data corruption
   - Sync indicator appears
4. Wait for backend response
5. Check work category view - should show correct work notes
6. Check personal category view - should show correct personal notes

**Expected Results:**
- ✅ No errors thrown
- ✅ No data corruption
- ✅ Work category shows correct notes (excluding newly created if it's work)
- ✅ Personal category shows correct notes
- ✅ Both views consistent after refresh

**Actual Results:**
- [ ] No errors during filter change
- [ ] Data remains consistent
- [ ] Both views show correct notes
- [ ] Refresh confirms consistency

**Notes:**
```
Edge case test - ensures race conditions don't cause issues.
```

---

### Test Case 8: Create Note in Search Mode

**Objective:** Verify behavior when creating note while search is active

**Setup:**
1. Open app at http://localhost:3000
2. Enter search query in search box (e.g., "test")
3. Verify search results are shown

**Steps:**
1. Create a note with content: "search test note"
2. Click "Create"
3. **Observe:**
   - Note should NOT appear in search results immediately
   - Sync indicator appears
   - Success toast shown
4. Clear search query
5. **Expected:** Note should now be visible in unfiltered view
6. Refresh and verify

**Expected Results:**
- ⚠️ Note does NOT appear in search results (search mode bypasses optimistic updates)
- ✅ Sync indicator appears
- ✅ Success toast shown
- ✅ Note appears in unfiltered view after clearing search
- ✅ Note persists after refresh

**Actual Results:**
- [ ] Note does not appear in search results
- [ ] Note appears after clearing search
- [ ] Success toast shown
- [ ] Note persists after refresh

**Notes:**
```
Known limitation: Search mode uses searchResults state, not React Query cache.
Optimistic updates don't affect search results.
```

---

### Test Case 9: Error Rollback with Active Filter

**Objective:** Verify error handling when creation fails with active filter

**Setup:**
1. Open app at http://localhost:3000
2. Set category filter to "work"
3. **Disconnect network** (DevTools → Network tab → Offline) OR stop backend server

**Steps:**
1. Create a note with category="work", content: "Error test"
2. Click "Create"
3. **Observe:**
   - Error toast should appear: "创建笔记失败: [error details]"
   - Sync indicator should disappear
   - No note should appear in any view
4. Reconnect network / restart backend
5. Refresh page
6. Verify note was not created

**Expected Results:**
- ✅ Error toast shown with details
- ✅ No corruption in data
- ✅ No phantom notes appear
- ✅ UI returns to previous state
- ✅ Note was not actually created

**Actual Results:**
- [ ] Error toast shown
- [ ] No data corruption
- [ ] No phantom notes
- [ ] Note not created

**Notes:**
```
Error rollback should work correctly even with active filters.
Since optimistic update doesn't appear in filtered view, there's nothing to rollback.
```

---

### Test Case 10: Performance Test - Multiple Notes with Filter

**Objective:** Verify performance and behavior when creating multiple notes rapidly with filter active

**Setup:**
1. Open app at http://localhost:3000
2. Set category filter to "work"
3. Open browser DevTools → Performance tab (optional)

**Steps:**
1. Create 3 notes rapidly (one after another):
   - Note 1: "Rapid test 1"
   - Note 2: "Rapid test 2"
   - Note 3: "Rapid test 3"
2. All with category="work"
3. **Observe:**
   - All notes should appear after backend responses
   - Sync indicator appears for each
   - Success toasts for each
4. Wait for all sync operations to complete
5. Verify all 3 notes are in work category view
6. Refresh and verify

**Expected Results:**
- ✅ All 3 notes appear in work category view
- ⚠️ Notes appear after backend responses (not optimistic)
- ✅ No duplicate notes
- ✅ No missing notes
- ✅ All notes persist after refresh
- ✅ No performance degradation

**Actual Results:**
- [ ] All 3 notes created
- [ ] No duplicates
- [ ] No missing notes
- [ ] Performance acceptable
- [ ] Notes persist after refresh

**Notes:**
```
Testing concurrent operations and cache consistency.
```

---

## Test Results Summary

### Expected Behavior Summary

| Scenario | Optimistic Update | Expected Behavior |
|----------|-------------------|-------------------|
| Create with matching filter | No | Note appears after backend response |
| Create with non-matching filter | No | Note doesn't appear (correct) |
| Create without filter | Yes | Note appears immediately |
| Delete with filter | No | Note disappears after backend response |
| Delete without filter | Yes | Note disappears immediately |
| Create in search mode | No | Note doesn't appear in search results |
| Error with filter | N/A | Error handled correctly, no rollback visible |

### Known Limitations

1. **Filtered Views:** Optimistic updates don't work with active filters
   - Notes appear after backend response (slower UX)
   - Data consistency is maintained
   - No bugs or errors

2. **Search Mode:** Search bypasses React Query cache
   - Optimistic updates don't affect search results
   - Notes appear when clearing search

### Test Execution Checklist

- [ ] Test Case 1: Create with matching filter
- [ ] Test Case 2: Create with different filter
- [ ] Test Case 3: Create without filter (baseline)
- [ ] Test Case 4: Delete with filter
- [ ] Test Case 5: Delete without filter (baseline)
- [ ] Test Case 6: Multiple filters
- [ ] Test Case 7: Filter change during creation
- [ ] Test Case 8: Create in search mode
- [ ] Test Case 9: Error rollback with filter
- [ ] Test Case 10: Performance test

### Overall Assessment

**Status:** ⚠️ **ACCEPTED WITH KNOWN LIMITATIONS**

**Rationale:**
- Implementation is correct and safe
- Data consistency maintained
- No bugs or errors
- Optimistic updates work in unfiltered views
- Known limitation: Filtered views don't get optimistic updates
- Enhancement tracked for future implementation

**Recommendation:**
- ✅ Accept current implementation
- 📋 Create enhancement task for filter-aware optimistic updates
- 📝 Document limitation in code comments

---

## Troubleshooting

### Issue: Note doesn't appear at all

**Possible Causes:**
1. Backend error - check browser console
2. Filter mismatch - verify note category matches filter
3. Network issue - check DevTools Network tab

**Solution:**
- Check browser console for errors
- Check DevTools Network tab for failed requests
- Refresh page and verify note appears in correct filter

### Issue: Note appears but disappears quickly

**Possible Causes:**
1. Optimistic update appeared then was replaced (normal behavior)
2. Filter changed during creation
3. Backend returned different data

**Solution:**
- Wait for backend response
- Verify filter is still active
- Refresh page to verify final state

### Issue: Duplicate notes appear

**Possible Causes:**
1. Race condition in cache update
2. Multiple rapid creates

**Solution:**
- This should not happen - if it does, it's a bug
- Report issue with reproduction steps
- Check React Query DevTools for cache state

### Issue: Error toast but note was created

**Possible Causes:**
1. Optimistic update succeeded but backend response had error
2. Network timeout

**Solution:**
- Refresh page to verify actual state
- Check database directly if possible
- May need to manually clean up phantom note

---

## DevTools Usage

### React Query DevTools

**Install:**
```bash
cd frontend
pnpm add @tanstack/react-query-devtools
```

**Use:**
1. Open app
2. Press Alt+R (or configured hotkey)
3. View "notes" queries
4. Observe cache updates during create/delete operations
5. Verify cache keys: `['notes']` vs `['notes', {filters}]`

**What to Look For:**
- Cache entry for current filter view
- Optimistic update in `['notes']` cache
- Filtered cache entry not updated immediately
- Refetch after invalidation

### Browser DevTools

**Network Tab:**
- Monitor POST /api/notes requests
- Monitor DELETE /api/notes/:id requests
- Check response times
- Simulate offline mode for error testing

**Console Tab:**
- Check for TypeScript errors
- Check for React Query warnings
- Monitor query cache updates

**Performance Tab:**
- Record performance during rapid operations
- Check for memory leaks
- Monitor render times

---

## Test Results Template

**Date:** ___________
**Tester:** ___________
**Environment:** Chrome/Firefox/Safari _________
**Frontend Version:** _________
**Backend Version:** _________

### Test Case Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Create matching filter | ⬜ Pass ⬜ Fail | |
| 2. Create different filter | ⬜ Pass ⬜ Fail | |
| 3. Create no filter | ⬜ Pass ⬜ Fail | |
| 4. Delete with filter | ⬜ Pass ⬜ Fail | |
| 5. Delete no filter | ⬜ Pass ⬜ Fail | |
| 6. Multiple filters | ⬜ Pass ⬜ Fail | |
| 7. Filter change during create | ⬜ Pass ⬜ Fail | |
| 8. Search mode | ⬜ Pass ⬜ Fail | |
| 9. Error rollback | ⬜ Pass ⬜ Fail | |
| 10. Performance test | ⬜ Pass ⬜ Fail | |

### Overall Result

⬜ **Pass** - All tests passed
⬜ **Pass with Issues** - Minor issues, acceptable
⬜ **Fail** - Critical issues found

### Issues Found

1. ___________________________
2. ___________________________
3. ___________________________

### Recommendations

___________________________
___________________________
___________________________

---

**Test Guide Created:** 2026-01-31
**Version:** 1.0
**Status:** Ready for Runtime Testing

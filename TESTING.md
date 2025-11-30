# Executor Functions - Testing Guide

## Manual Testing Checklist

### Phase 7: Testing & Error Handling

#### Test 1: Basic Executor Configuration

- [ ] Click Settings button on task-1 node
- [ ] Verify modal opens with default executor code
- [ ] Modify code (e.g., add a field to output)
- [ ] Click "Save Function"
- [ ] Verify Settings button turns green (indicating configured executor)

#### Test 2: Test Panel Functionality

- [ ] Open executor editor
- [ ] Enter test input JSON: `{"test": true}`
- [ ] Click "Run Test"
- [ ] Verify output appears in test panel
- [ ] Try invalid JSON - verify error message

#### Test 3: Sync Executor Execution

- [ ] Configure task-1 with sync function: `return { ...nodeInput, sync: true };`
- [ ] Run workflow (성공 실행 button)
- [ ] Verify workflow executes successfully
- [ ] Check console for no errors

#### Test 4: Async Executor with fetch

- [ ] Configure service-1 with async function
- [ ] Add fetch call (use JSONPlaceholder API for testing):

```javascript
const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");
const data = await response.json();
return { ...nodeInput, apiData: data };
```

- [ ] Verify "Async Detected" badge appears automatically
- [ ] Run workflow
- [ ] Verify data flows through correctly

#### Test 5: Decision Node Evaluator

- [ ] Configure decision-1 evaluator: `return nodeInput`
- [ ] Run workflow in success mode
- [ ] Verify it takes "Yes" path (to service-1)
- [ ] Modify evaluator to return false
- [ ] Run again, verify it takes "No" path (to task-2)

#### Test 6: Compilation Error Handling

- [ ] Open executor editor
- [ ] Enter invalid JavaScript: `this is not valid`
- [ ] Verify compilation error appears in red box
- [ ] Verify "Save Function" button is disabled
- [ ] Fix the code
- [ ] Verify error disappears and save is enabled

#### Test 7: Runtime Error Handling

- [ ] Configure executor that throws error: `throw new Error("Test error");`
- [ ] Run workflow
- [ ] Verify execution stops at that node
- [ ] Check execution statistics show error count

#### Test 8: Timeout Protection

- [ ] Configure async executor with infinite loop:

```javascript
await new Promise((resolve) => setTimeout(resolve, 60000));
return nodeInput;
```

- [ ] Run workflow
- [ ] Verify execution times out after 30 seconds
- [ ] Verify timeout error is displayed

#### Test 9: Fallback Behavior

- [ ] Remove executorConfig from a node (set to undefined)
- [ ] Run workflow
- [ ] Verify node uses default behavior:
  - Task/Service: identity function (output = input)
  - Decision: mode-based (success/failure buttons)

#### Test 10: Data Flow Visualization

- [ ] Configure multiple nodes with executors
- [ ] Run workflow
- [ ] Verify:
  - Each node shows input/output data
  - Edges animate during data transfer
  - Execution state updates in real-time
  - Statistics panel shows correct counts

## Expected Results

### Success Criteria

✅ All Settings buttons functional
✅ Modal opens/closes correctly
✅ Code editor validates in real-time
✅ Test panel executes code with sample input
✅ Sync functions execute correctly
✅ Async functions with fetch work
✅ Decision evaluators control branching
✅ Compilation errors prevented from saving
✅ Runtime errors caught and displayed
✅ 30-second timeout protection works
✅ Fallback to default behavior when no executor
✅ Data visualization updates during execution

### Known Limitations

⚠️ No syntax highlighting in code editor (MVP limitation)
⚠️ fetch API subject to CORS restrictions
⚠️ No rate limiting on fetch calls
⚠️ No memory usage monitoring
⚠️ Function constructor security (suitable for trusted users only)

## Performance Testing

### Metrics to Monitor

- Build time: Should remain under 3 seconds
- Modal open time: Should be instant (<100ms)
- Code compilation: Should be near-instant for typical functions
- Execution time: Varies based on function complexity

### Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (WebKit)

# Automated Review Flow Test

This script automates the complete review flow to verify that all questions appear correctly and can be answered.

## Prerequisites

1. **Electron app running**: Start the app with remote debugging enabled:
   ```bash
   npm run electron:dev
   ```

2. **Dependencies installed**: The script requires the `ws` package:
   ```bash
   npm install --save-dev ws
   ```

3. **Projects available**: Ensure you have at least one project in the review queue

## Usage

```bash
cd weekly-review-hud
node dev-tools/test-review-flow.js
```

## What It Tests

The script verifies:

1. **Connection**: Connects to the Electron app via CDP (port 9222)
2. **App Ready**: Verifies the app is loaded and ready
3. **Review Start**: Clicks "Start Review" or selects a project
4. **Question Verification**: For each question:
   - Verifies the question text appears correctly
   - Verifies the correct input type is displayed (text/yes-no/mood)
   - Answers the question appropriately
5. **Navigation**: Moves through all questions sequentially
6. **Completion**: Completes the review and verifies final state

## Expected Questions

### First Review (6 questions)
1. **q-purpose** (text): "Why am I doing this project?"
2. **q-reality** (text): "Where am I right now with it?"
3. **q-next** (yes-no): "Is this the clearly defined, physical Next Action?"
4. **q-timeline** (text): "What's the realistic timeline for this project?"
5. **q-align** (text): "Does this align with higher-level goals?"
6. **q-engage** (mood): "Am I engaged and motivated?"

### Subsequent Review (6 questions)
1. **q-relevance** (text): "Is this project still relevant to my goals?"
2. **q-reality** (text): "Where am I right now with it?"
3. **q-next** (text): "Is this the clearly defined, physical Next Action?"
4. **q-timeline** (text): "Is the timeline still realistic? Any adjustments needed?"
5. **q-align** (text): "Does this align with higher-level goals?"
6. **q-engage** (mood): "Am I engaged and motivated?"

## Test Answers

The script uses predefined test answers:
- Text questions: Short descriptive answers
- Yes/No questions: `true` (Yes)
- Mood questions: `2` (Neutral)

## Troubleshooting

### "No debugging targets found"
- Make sure the Electron app is running: `npm run electron:dev`
- Verify port 9222 is accessible: `curl http://localhost:9222/json/version`

### "Could not find Start Review button"
- The script tries multiple selectors to find the start button
- Make sure you're on the queue screen
- Check browser console for any errors

### "Question element not found"
- The app may not have fully loaded
- Try increasing sleep delays in the script
- Check that the review questions file is loaded correctly

### "Could not find text input field"
- The question type may have changed
- Verify the question type in `review-questions.md`
- Check the DOM structure in DevTools

## Customization

To modify test behavior, edit `test-review-flow.js`:

- **Change test answers**: Modify the `TEST_ANSWERS` object
- **Adjust timing**: Change `sleep()` delays
- **Add assertions**: Add verification steps after each question
- **Test different flows**: Modify to test skip, complete, or archive actions

## Integration with CI/CD

This script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Start Electron app
  run: npm run electron:dev &
  
- name: Wait for app to start
  run: sleep 5
  
- name: Run review flow test
  run: node dev-tools/test-review-flow.js
```

## Output

The script provides detailed logging:
- ✅ Success messages (green checkmark)
- ⚠️ Warnings (yellow warning)
- ❌ Errors (red X)
- ℹ️ Info messages (blue info)

Successful completion shows:
```
╔══════════════════════════════════════════════════════════════╗
║      Test Completed Successfully                            ║
╚══════════════════════════════════════════════════════════════╝
```


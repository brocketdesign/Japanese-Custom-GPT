# Chat Model Testing Dashboard - Visual Guide

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Chat Model Testing Dashboard                       │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌─────────────────────────────────────┐
│   CONTROL PANEL          │  │   MAIN CONTENT AREA                 │
│   (Left Sidebar)         │  │                                     │
│                          │  │  System Prompt Configuration        │
│ ☐ Model Selection        │  │  ┌─────────────────────────────┐   │
│   ☐ Llama 3 70B          │  │  │ [Reset] System Prompt       │   │
│   ☐ DeepSeek V3 Turbo    │  │  │ You are a helpful...        │   │
│   ☐ Mistral Nemo         │  │  │ [text area]                 │   │
│   ☐ Hermes 2 Pro         │  │  └─────────────────────────────┘   │
│ Selected: 0/3            │  │                                     │
│                          │  │  Test Questions                     │
│ Languages                │  │  ┌─────────────────────────────┐   │
│ [Select All] [Clear]     │  │  │ Q1: [text input] [✕]        │   │
│ ☑ English                │  │  │ Q2: [text input] [✕]        │   │
│ ☐ Français               │  │  │ Q3: [text input] [✕]        │   │
│ ☐ 日本語                 │  │  │ Q4: [text input] [✕]        │   │
│ 1 language selected      │  │  │ Q5: [text input] [✕]        │   │
│                          │  │  │ [+ Add Question]             │   │
│ Max Tokens: [1000]       │  │  │ 5/5 questions added          │   │
│                          │  │  └─────────────────────────────┘   │
│ [▶ Run Test]             │  │                                     │
│ [📥 Export] [🔄 Reset]   │  │                                     │
│                          │  │                                     │
└──────────────────────────┘  └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  TEST RESULTS                                                        │
│  [◉ Comparison View] [ Statistics ]                                  │
│                                                                       │
│  Language | Question | Model | Response Time | Tokens | Actions     │
│  ─────────┼──────────┼───────┼───────────────┼────────┼─────────    │
│  EN       | What is..| Llama | 1234ms        | 256    | [View]      │
│  EN       | What is..| Deep..| 892ms         | 198    | [View]      │
│  FR       | Qu'est...| Llama | 1456ms        | 287    | [View]      │
│  ...      | ...      | ...   | ...           | ...    | ...         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  TEST HISTORY                                                        │
│                                                                       │
│  Date/Time        | Models        | Languages | Questions | Actions  │
│  ─────────────────┼───────────────┼───────────┼───────────┼─────────│
│  2025-11-04 10:30 | llama, mistral| en, fr    | 3 q       | [View]  │
│                   |               |           |           | [Restore]│
│                   |               |           |           | [Delete] │
│  ─────────────────┼───────────────┼───────────┼───────────┼─────────│
│  2025-11-04 09:15 | deepseek      | en        | 5 q       | [View]  │
│                   |               |           |           | [Restore]│
│                   |               |           |           | [Delete] │
└──────────────────────────────────────────────────────────────────────┘
```

## New Button Locations

### 1. Reset Test Button
```
Left Panel Footer:
┌────────────────────┐
│ [▶ Run Test]       │
│ [📥 Export] [Reset]│
└────────────────────┘
```

### 2. Language Bulk Selection
```
Left Panel Languages:
┌─────────────────────────────┐
│ Languages                   │
│ [Select All] [Clear]        │
│ ☑ English                   │
│ ☐ Français                  │
│ ☐ 日本語                    │
│ 1 language selected         │
└─────────────────────────────┘
```

### 3. Restore Configuration Button
```
History Table Actions Column:
┌─────────────────────┐
│ [View]              │  ← View test results
│ [Restore]           │  ← Load test settings
│ [Delete]            │  ← Remove test
└─────────────────────┘
```

## Feature Workflows

### Workflow 1: Reset & Rerun Test
```
1. Configure test
   └─> Add questions
   └─> Select models
   └─> Select languages

2. Run test
   └─> View results

3. Click "Reset Test"
   └─> All settings cleared
   └─> Returns to defaults

4. Reconfigure and run again
```

### Workflow 2: Test All Languages
```
1. Add questions

2. Click "Select All" in Languages
   └─> All 3 languages auto-selected
   └─> Shows "3 languages selected"

3. Select models

4. Run test
   └─> Tests same questions in EN, FR, JA
```

### Workflow 3: Repeat Previous Test
```
1. Find test in History
   └─> Shows date/time
   └─> Shows models used
   └─> Shows languages used
   └─> Shows question count

2. Click "Restore"
   └─> All settings loaded
   └─> Shows timestamp confirmation

3. Edit if needed

4. Click "Run Test"
   └─> Same configuration re-run
```

### Workflow 4: Compare Models
```
1. Create Test A with Model X
   └─> Run and save results

2. In History, find Test A

3. Click "Restore"
   └─> Configuration loaded

4. Change model selection to Model Y

5. Click "Run Test"
   └─> Same questions, different model

6. Compare results in table
```

## Button Reference

| Button | Location | Function | Icon |
|--------|----------|----------|------|
| **Run Test** | Left Panel | Start testing all models | ▶ |
| **Export Results** | Left Panel | Download as CSV | 📥 |
| **Reset Test** | Left Panel | Clear all settings | 🔄 |
| **Select All** | Languages | Select all languages | ✓✓✓ |
| **Clear** | Languages | Deselect all languages | ✕✕✕ |
| **View** | History | See test results | 👁 |
| **Restore** | History | Load test configuration | ⟲ |
| **Delete** | History | Remove test record | 🗑 |

## Keyboard Shortcuts (Future Enhancement)

```
Ctrl/Cmd + A  →  Select All Languages
Ctrl/Cmd + R  →  Reset Test
Ctrl/Cmd + L  →  Run Test
```

## Color Coding

```
✓ Success/Positive  → Green buttons
⚠ Warning/Caution   → Yellow/Orange buttons
✕ Danger/Delete     → Red buttons
ℹ Info/Primary      → Blue buttons
- Secondary/Export  → Gray buttons
```

## Status Indicators

```
[▶ Run Test]           → Ready to test
[⏳ Running Tests...]  → Test in progress
[✓ Complete]           → Test finished
[✕ Error]              → Something failed
[📊 3 languages]       → Languages selected
[0/3 Models]           → Models selected
```

## Data Flow

```
User Input
    ↓
┌─────────────────────┐
│ Configuration Panel │ ← Models, Languages, Questions
└──────────┬──────────┘
           ↓
      Run Test
           ↓
┌─────────────────────┐
│ API Call            │ ← Test Multiple Models
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Save to Database    │ ← Store Results
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Display Results     │ ← Show in Table
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ History/Export      │ ← Reload or Download
└─────────────────────┘
```

## State Management

```
Global Variables:
├─ selectedModels []        → Current models selected
├─ questions []             → Current test questions
├─ testResults {}           → Current test results
└─ availableModels {}       → Static model list

DOM Elements:
├─ modelCheckboxes          → Model selection inputs
├─ languageCheckboxes       → Language selection inputs
├─ questionsContainer       → Questions display area
├─ resultsTable             → Results display table
└─ historyTable             → History display table
```

## Event Listeners

```
Attached to:
├─ .model-select            → updateSelectedModels()
├─ .language-select         → updateLanguageCount()
├─ .question-input          → updateQuestionCount()
├─ #runTestBtn              → runTest()
├─ #resetTestBtn            → resetTest()
├─ #resetPromptBtn          → resetPrompt()
├─ #selectAllLanguagesBtn   → selectAllLanguages()
├─ #clearLanguagesBtn       → clearLanguages()
├─ #exportResultsBtn        → exportResults()
├─ input[viewMode]          → switchView()
└─ History buttons          → viewTestDetails(), restoreTestConfiguration(), deleteTest()
```

## Error States

```
Validation Errors:
├─ "Please select at least one model"
├─ "Please select at least one language"
└─ "Please add at least one question"

API Errors:
├─ "Failed to load test details: [error]"
├─ "Failed to restore configuration: [error]"
└─ "Failed to delete test"

Success Messages:
├─ "Test completed successfully!"
├─ "Test configuration restored from [timestamp]"
├─ "Result deleted successfully"
└─ "Test configuration has been reset to defaults"
```

## Accessibility

```
Buttons have:
├─ Clear labels
├─ Tooltips on hover
├─ Icons for visual clarity
├─ Keyboard support (tab, enter)
└─ Color + text (not color alone)

Forms have:
├─ Labels for inputs
├─ Placeholders for guidance
├─ Error messages
└─ Success confirmations

Table has:
├─ Column headers
├─ Row highlighting
├─ Button clarity
└─ Modal for details
```

## Mobile Responsiveness

```
Desktop (≥992px):      Tablet (768-991px):    Mobile (<768px):
┌────┬──────────────┐  ┌────┬─────────────┐  ┌──────────────┐
│Ctrl│ Main Content │  │    Main Content │  │   Stacked    │
│ Pn │              │  │                 │  │   Layout     │
│    │              │  │    (No Sidebar) │  │              │
└────┴──────────────┘  └─────────────────┘  └──────────────┘
```

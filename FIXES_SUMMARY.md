# Character Creation Fixes - Summary

## Issues Fixed

### 1. Male Characters Still Had Female Traits
**Root Cause**: The AI was not properly constrained to respect the selected gender. The `extractDetailsFromPrompt` function accepted a gender parameter but didn't enforce it in the AI prompt, allowing the AI to infer gender from the character description instead.

**Fix**: 
- Modified `extractDetailsFromPrompt` in `routes/character-creation-api.js` to explicitly instruct the AI to use the provided gender parameter
- Added "IMPORTANT" markers to force the AI to honor the gender constraint
- Added clear instructions that if description contradicts gender, adapt other characteristics instead

### 2. NSFW Content Appearing in Character Creation
**Root Cause**: Multiple issues contributed to this:
1. Default prompts had weak SFW negative prompts
2. Feminine-specific LoRAs (like "PerfectFullBreasts") were always applied, even for male characters and SFW mode
3. Missing constraint for "upper body only" in prompts
4. No gender-based LoRA filtering for character creation

**Fixes**:
- **Enhanced default prompts** in `models/imagen.js`:
  - Added "upper body portrait" to prompts
  - Expanded negative prompts to include: `exposed breasts, cleavage, bikini, revealing clothing, lower body`
  - Added FLUX-specific negative prompts

- **Added conditional LoRA filtering** in `models/imagen.js`:
  - For character creation with SFW, removed breast-specific and feminine LoRAs
  - For male characters in SFW character creation, further restricted anime/doll-like LoRAs
  - Maintained these LoRAs for NSFW and regular non-creation mode

- **Strengthened image prompt generation** in `routes/character-creation-api.js`:
  - Updated `createSystemPayload()` function with CRITICAL SFW REQUIREMENTS
  - Added explicit constraint: "NO nudity, NO exposed skin beyond neck/shoulders/arms"
  - Added gender-specific clothing instructions
  - Added multiple reminder layers about upper body portrait only

- **Saved gender to chat before image generation** in `routes/character-creation-api.js`:
  - Gender is now persisted to the database immediately after extraction
  - This ensures `generateImg` function can access the correct gender when building prompts

## Files Modified

1. **routes/character-creation-api.js**
   - Updated `extractDetailsFromPrompt()` with gender enforcement
   - Updated `createSystemPayload()` with stronger SFW constraints
   - Added gender persistence before image generation

2. **models/imagen.js**
   - Updated `default_prompt` object with enhanced SFW constraints
   - Added negative_prompt to FLUX defaults
   - Added conditional LoRA filtering based on gender and chatCreation flag
   - Removed gender-biased LoRAs from SFW character creation mode

## Testing Recommendations

1. Create a male character - verify:
   - No feminine traits in generated character details
   - No exposed breasts or revealing clothing in images
   - Masculine features in facial details and body type

2. Create a female character - verify:
   - Feminine traits are preserved
   - Still maintain SFW standards (fully clothed, no nudity)
   - Upper body portrait only

3. Verify NSFW restrictions for non-premium users work correctly

4. Test with different character descriptions to ensure AI respects selected gender

## Key Changes Made

### Character Extraction (extractDetailsFromPrompt)
```javascript
// Now includes explicit gender enforcement:
IMPORTANT: The character gender MUST be "${gender}". Do NOT change this based on the description.
If the description seems to contradict the gender, adapt other characteristics to match the specified gender instead.
```

### Image Prompt Generation (createSystemPayload)
```javascript
// Now includes explicit SFW requirements:
CRITICAL SFW REQUIREMENTS:
- The image MUST be ONLY a face and upper body portrait (shoulders to head, no lower body)
- NO nudity, NO exposed skin beyond neck/shoulders/arms
- Character MUST be fully clothed and modestly dressed
- NO cleavage, NO exposed breasts, NO revealing clothing
- NO sexual or suggestive content whatsoever
```

### LoRA Filtering
```javascript
// For character creation SFW, filter out feminine-specific LoRAs:
selectedLoras = selectedLoras.filter(lora => 
    !lora.model_name.toLowerCase().includes('breast') && 
    !lora.model_name.toLowerCase().includes('feminine')
);

// For male characters, further restrict anime/doll-like traits
if (gender === 'male') {
    selectedLoras = selectedLoras.filter(lora => 
        !lora.model_name.toLowerCase().includes('doll') && 
        !lora.model_name.toLowerCase().includes('japan')
    );
}
```

### Gender Persistence
Gender is now saved to the chat database immediately after extraction, ensuring the image generation function has accurate gender information for all subsequent operations.

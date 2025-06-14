// Utilities Module
// Contains utility functions, error handling, and helper methods

import { MODEL_CODENAMES } from './config.js';

// Copy text to clipboard with visual feedback
export async function copyText(text, buttonElement = null) {
    try {
        await navigator.clipboard.writeText(text);
        
        if (buttonElement) {
            // Store original content
            const originalIcon = buttonElement.querySelector('.copy-icon-default');
            const copiedIcon = buttonElement.querySelector('.copy-icon-copied');
            
            if (originalIcon && copiedIcon) {
                // Show copied state
                originalIcon.style.display = 'none';
                copiedIcon.style.display = 'inline';
                buttonElement.classList.add('copied');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    originalIcon.style.display = 'inline';
                    copiedIcon.style.display = 'none';
                    buttonElement.classList.remove('copied');
                }, 2000);
            }
        }
        
        console.log('Text copied to clipboard');
        return true;
    } catch (error) {
        console.error('Failed to copy text:', error);
        // Fallback for older browsers
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (fallbackError) {
            console.error('Fallback copy also failed:', fallbackError);
            return false;
        }
    }
}

// HTML escape function for security
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Error display functions
export function showError(message, elementId = 'generalError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 10000);
    }
    console.error('Error displayed:', message);
}

export function showConsensusError(message) {
    const errorElement = document.getElementById('consensusError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

export function showJsonError(message) {
    const errorElement = document.getElementById('jsonError');
    if (errorElement) {
        if (message.includes('retry')) {
            errorElement.innerHTML = `
                <div class="error-content">
                    <span class="error-text">${message}</span>
                    <button class="neu-button retry-json-btn" onclick="window.retryJsonConversion()">
                        Retry JSON Conversion
                    </button>
                </div>
            `;
        } else {
            errorElement.textContent = message;
        }
        errorElement.style.display = 'block';
    }
}

// Model name mapping functions
export function createModelNameMapping(selectedModels) {
    const mapping = {};
    const codeMapping = {};
    
    selectedModels.forEach((model, index) => {
        // Use the hardcoded anonymous codenames
        const modelCode = MODEL_CODENAMES[model.id] || `llm-${index}`;
        mapping[model.id] = modelCode;
        // Store the mapping for JSON conversion (which needs to know real names)
        codeMapping[modelCode] = model.name;
    });
    
    return { mapping, codeMapping };
}

// Download JSON file
export function downloadJson(data, filename = 'consensus-analysis.json') {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}

// Helper functions for analytics
export function getConsensusIcon(consensusType) {
    switch (consensusType?.toLowerCase()) {
        case 'unanimous': return '<i data-lucide="check-circle"></i>';
        case 'majority': return '<i data-lucide="users"></i>';
        case 'split': return '<i data-lucide="zap"></i>';
        case 'single': return '<i data-lucide="user"></i>';
        case 'none': return '<i data-lucide="x-circle"></i>';
        default: return '<i data-lucide="help-circle"></i>';
    }
}

export function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getControversyScore(theme) {
    const controversyTypes = {
        'split': 100,
        'none': 90,
        'single': 30,
        'majority': 20,
        'unanimous': 0
    };
    return controversyTypes[theme.consensusType?.toLowerCase()] || 50;
}

export function getHeatmapColor(score) {
    if (score >= 80) return { bg: '#ef4444', text: 'white' }; // High controversy - red
    if (score >= 60) return { bg: '#f59e0b', text: 'white' }; // Medium-high - orange
    if (score >= 40) return { bg: '#eab308', text: 'black' }; // Medium - yellow
    if (score >= 20) return { bg: '#22c55e', text: 'white' }; // Low - green
    return { bg: '#10b981', text: 'white' }; // Very low - dark green
}

export function getShortModelName(fullName) {
    // If it's already a codename, return it as is
    if (fullName.startsWith('llm-')) {
        return fullName;
    }
    
    // Shorten long model names for display
    const nameMap = {
        'Claude Sonnet 4': 'CS4',
        'O4 Mini High': 'O4M',
        'GPT-4.1': 'G41',
        'DeepSeek R1': 'DS1',
        'Claude Opus 4': 'CO4',
        'ChatGPT 4o': 'C4o',
        'Gemini 2.5 Flash Thinking': 'GFT',
        'Gemini Pro 2.5': 'GP2',
        'Qwen3 30B': 'Q30',
        'Grok 3 Beta': 'G3B'
    };
    return nameMap[fullName] || fullName.substring(0, 6);
}

export function getAgreementColorClass(percentage) {
    if (percentage >= 90) return 'high-agreement';
    if (percentage >= 70) return 'medium-agreement';
    if (percentage >= 50) return 'low-agreement';
    return 'no-agreement';
}

export function getConsensusColor(consensusType) {
    const colors = {
        'unanimous': '#22c55e',
        'majority': '#3b82f6',
        'split': '#f59e0b',
        'single': '#6b7280',
        'none': '#ef4444'
    };
    return colors[consensusType?.toLowerCase()] || colors.none;
}

// Calculate consensus score (0-100)
export function calculateConsensusScore(themes) {
    if (!themes || themes.length === 0) return 0;
    
    let totalScore = 0;
    let weightedTotal = 0;
    
    themes.forEach(theme => {
        const importance = theme.importanceScore || 5;
        let themeScore = 0;
        
        switch (theme.consensusType?.toLowerCase()) {
            case 'unanimous': themeScore = 100; break;
            case 'majority': themeScore = 75; break;
            case 'split': themeScore = 25; break;
            case 'single': themeScore = 10; break;
            case 'none': themeScore = 0; break;
            default: themeScore = 50;
        }
        
        totalScore += themeScore * importance;
        weightedTotal += importance;
    });
    
    return weightedTotal > 0 ? Math.round(totalScore / weightedTotal) : 0;
}

// Extract JSON from model response with enhanced cleaning
export function extractJsonFromResponse(responseText) {
    console.log('=== JSON Extraction Started ===');
    console.log('Response length:', responseText.length);
    
    try {
        // Store original for debugging
        const originalText = responseText;
        
        // Step 1: Basic cleanup
        let cleanText = responseText.trim();
        
        // Step 2: Remove markdown code blocks (multiple patterns)
        cleanText = cleanText
            .replace(/^```(?:json)?\s*/i, '')  // Start marker
            .replace(/\s*```$/i, '')           // End marker
            .replace(/^```[\s\S]*?\n/m, '')   // Full code block start
            .replace(/\n```[\s\S]*?$/m, '');  // Full code block end
        
        // Step 3: Check if the response is already valid JSON
        try {
            // Try parsing the cleaned text as-is first
            const testParse = JSON.parse(cleanText);
            // If it works, we're done!
            console.log('Response was already valid JSON');
            return sanitizeJsonData(testParse);
        } catch (e) {
            // Continue with extraction
            console.log('Response needs extraction/cleaning');
        }
        
        // Step 3b: Extract JSON object (improved detection)
        let jsonText = '';
        
        // Try method 1: Find outermost braces
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            jsonText = cleanText.substring(firstBrace, lastBrace + 1);
        } else {
            // Try method 2: Regex for JSON object
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/m);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            } else {
                throw new Error('No JSON object found in response');
            }
        }
        
        console.log('Extracted JSON length:', jsonText.length);
        
        // Step 4: Check if single-quoted JSON and convert
        if (jsonText.includes("'") && !jsonText.includes('"')) {
            console.log('Detected single-quoted JSON, converting to double quotes');
            // Convert single quotes to double quotes for JSON parsing
            jsonText = jsonText
                .replace(/'/g, '"')
                // But restore escaped single quotes within strings
                .replace(/\\"/g, "'");
        }
        
        // Step 4b: Clean common LLM issues
        jsonText = jsonText
            // Remove trailing commas before closing braces/brackets
            .replace(/,\s*([}\]])/g, '$1')
            // Fix smart quotes to regular quotes
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            // Remove single-line comments
            .replace(/\/\/[^\n\r]*$/gm, '')
            // Remove multi-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Remove any BOM characters
            .replace(/^\uFEFF/, '')
            // Remove any control characters except newlines and tabs in strings
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Step 5: Attempt to parse
        let jsonData;
        try {
            jsonData = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Initial parse failed:', parseError.message);
            console.log('First 200 chars of JSON that failed:', jsonText.substring(0, 200));
            
            // Try different approaches
            try {
                // Approach 1: Try to fix common syntax errors
                jsonText = attemptJsonRepair(jsonText);
                jsonData = JSON.parse(jsonText);
            } catch (repairError) {
                console.error('Repair attempt failed:', repairError.message);
                
                // Approach 2: Try using Function constructor (more lenient)
                try {
                    jsonData = (new Function('return ' + jsonText))();
                } catch (funcError) {
                    console.error('Function constructor failed:', funcError.message);
                    
                    // Approach 3: Try eval as last resort (safe in this context)
                    try {
                        jsonData = eval('(' + jsonText + ')');
                    } catch (evalError) {
                        console.error('All parsing attempts failed');
                        throw parseError; // Throw original error
                    }
                }
            }
        }
        
        console.log('JSON parsed successfully');
        
        // Step 6: Validate structure for v2 format
        if (!jsonData.themes && !jsonData.summary) {
            // Check if it's v1 format and needs migration
            if (jsonData.insights || jsonData.modelBehavior) {
                console.log('Detected v2 format without summary');
                // v2 format doesn't require summary at top level
            } else {
                throw new Error('Invalid JSON structure - missing required fields');
            }
        }
        
        // Filter out any potentially malicious content
        return sanitizeJsonData(jsonData);
        
    } catch (error) {
        console.error('=== JSON Extraction Failed ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // Log first 500 chars of response for debugging
        console.log('Response preview:', responseText.substring(0, 500));
        
        throw new Error(`JSON extraction failed: ${error.message}`);
    }
}

// Attempt to repair common JSON syntax errors
function attemptJsonRepair(jsonText) {
    console.log('Attempting JSON repair...');
    
    let repaired = jsonText;
    
    // Log what we're trying to repair
    console.log('Sample of text to repair:', repaired.substring(0, 100));
    
    // Fix missing quotes on property names
    repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Fix single quotes to double quotes for property names and values
    // But be careful not to replace quotes inside strings
    repaired = repaired.replace(/([\{,:]\s*)'([^']*)'/g, '$1"$2"');
    
    // Remove or escape actual newlines in strings
    repaired = repaired.replace(/"([^"]*)"/g, function(match, content) {
        // Replace actual newlines with escaped newlines
        return '"' + content.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    });
    
    // Ensure arrays are properly closed
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
        repaired += ']'.repeat(openBrackets - closeBrackets);
    }
    
    // Ensure objects are properly closed
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
        repaired += '}'.repeat(openBraces - closeBraces);
    }
    
    console.log('JSON repair completed');
    return repaired;
}

// Sanitize JSON data to prevent potential security issues
function sanitizeJsonData(data) {
    // Remove any potential script tags or dangerous content
    const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
    ];
    
    function cleanValue(value) {
        if (typeof value === 'string') {
            dangerousPatterns.forEach(pattern => {
                value = value.replace(pattern, '[FILTERED]');
            });
            return value;
        } else if (Array.isArray(value)) {
            return value.map(cleanValue);
        } else if (typeof value === 'object' && value !== null) {
            const cleaned = {};
            Object.keys(value).forEach(key => {
                cleaned[key] = cleanValue(value[key]);
            });
            return cleaned;
        }
        return value;
    }
    
    return cleanValue(data);
}

// Get selected consensus model from dropdown
export function getSelectedConsensusModel() {
    const consensusModelSelect = document.getElementById('consensusModelSelect');
    if (consensusModelSelect) {
        return consensusModelSelect.value;
    }
    // Default fallback
    return 'google/gemini-2.5-pro-preview';
}

// Get selected JSON model from dropdown
export function getSelectedJsonModel() {
    const jsonModelSelect = document.getElementById('jsonModelSelect');
    if (jsonModelSelect) {
        return jsonModelSelect.value;
    }
    // Default fallback
    return 'openai/gpt-4.1';
}

// Make functions available globally for HTML onclick handlers
window.copyText = copyText;
window.downloadJson = downloadJson;
// API Module
// Handles all OpenRouter API communications and response processing

import { CONFIG } from './config.js';

// API key status management
export let apiKeyStatus = 'checking';

export function checkApiKey() {
    if (CONFIG.OPENROUTER_API_KEY) {
        apiKeyStatus = 'valid';
        return 'valid';
    } else {
        apiKeyStatus = 'missing';
        return 'missing';
    }
}

// Main function to query multiple models simultaneously
export async function queryOpenRouterModels(selectedModels, userPrompt, loadingCallbacks) {
    const results = [];
    const promises = selectedModels.map(async (model, index) => {
        try {
            const result = await querySingleModel(model, userPrompt, index, loadingCallbacks);
            const finalResult = { ...result, originalIndex: index };
            
            // Call the onResponse callback if provided
            if (loadingCallbacks && loadingCallbacks.onResponse) {
                loadingCallbacks.onResponse(index, finalResult);
            }
            
            return finalResult;
        } catch (error) {
            console.error(`Error querying ${model.name}:`, error);
            const errorResult = {
                model: model,
                success: false,
                error: error.message || 'Unknown error occurred',
                response: '',
                originalIndex: index
            };
            
            // Call the onResponse callback for errors too
            if (loadingCallbacks && loadingCallbacks.onResponse) {
                loadingCallbacks.onResponse(index, errorResult);
            }
            
            return errorResult;
        }
    });

    const responses = await Promise.all(promises);
    
    // Sort responses back to original order
    responses.sort((a, b) => a.originalIndex - b.originalIndex);
    
    return responses.map(({ originalIndex, ...rest }) => rest);
}

// Function to query a single model
async function querySingleModel(model, userPrompt, index, loadingCallbacks) {
    const requestBody = {
        model: model.id,
        messages: [
            {
                role: "user",
                content: userPrompt
            }
        ],
        temperature: 0.7,
        max_tokens: Math.min(model.maxOutputTokens, 16000),
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0
    };

    console.log(`Querying ${model.name} (${model.id})`);

    if (loadingCallbacks && loadingCallbacks.start) {
        loadingCallbacks.start(index, model.name);
    }

    try {
        const response = await fetch(CONFIG.OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'PolyLLM Consensus Engine'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (loadingCallbacks && loadingCallbacks.stop) {
            loadingCallbacks.stop(index);
        }

        if (!response.ok) {
            console.error(`HTTP error for ${model.name}:`, response.status, data);
            throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`);
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error(`Invalid response format for ${model.name}:`, data);
            throw new Error('Invalid response format - no message content');
        }

        const content = data.choices[0].message.content;
        
        if (!content || content.trim() === '') {
            throw new Error('Empty response content');
        }

        console.log(`Successfully received response from ${model.name}`);
        
        return {
            model: model,
            success: true,
            response: content,
            usage: data.usage || {}
        };

    } catch (error) {
        if (loadingCallbacks && loadingCallbacks.stop) {
            loadingCallbacks.stop(index);
        }
        
        console.error(`Error with ${model.name}:`, error);
        throw error;
    }
}

// Function to load JSON conversion prompt template
export async function loadJsonConversionPrompt(filename = 'prompts/json-conversion-prompt.txt') {
    try {
        const response = await fetch(filename);
        if (response.ok) {
            const template = await response.text();
            console.log(`JSON conversion prompt template loaded successfully from ${filename}`);
            return template;
        } else {
            console.error(`Failed to load JSON conversion prompt template from ${filename}:`, response.status);
            return getFallbackJsonPrompt();
        }
    } catch (error) {
        console.error('Error loading JSON conversion prompt:', error);
        return getFallbackJsonPrompt();
    }
}

// Fallback JSON conversion prompt
function getFallbackJsonPrompt() {
    return `Convert the following consensus analysis into a structured JSON format. Extract and classify model positions WITHOUT performing any calculations.

IMPORTANT: The consensus analysis uses anonymous model codes. Here is the mapping to actual model names:
{{MODEL_CODE_MAPPING}}

When creating the JSON output, replace the anonymous model codes with the actual model names using the mapping above.

Please structure the data as follows:
{
    "themes": [
        {
            "name": "theme name",
            "statement": "what was concluded about this theme",
            "modelPositions": {
                "Actual Model Name 1": {
                    "stance": "agree|disagree|neutral|not_mentioned",
                    "quote": "relevant quote if available",
                    "reasoning": "brief explanation of their position"
                }
            },
            "disagreements": [
                {
                    "model": "Actual Model Name",
                    "position": "what they said",
                    "significance": "why this disagreement matters"
                }
            ],
            "importance": "high|medium|low"
        }
    ],
    "insights": {
        "mainConclusion": "overall synthesis conclusion",
        "keyFindings": ["finding 1", "finding 2"],
        "surprisingPatterns": "any unexpected observations",
        "practicalImplications": "what this means for decision-making"
    },
    "modelBehavior": {
        "Actual Model Name 1": {
            "responseStyle": "concise|detailed|balanced|creative|analytical",
            "tendencies": ["tendency 1", "tendency 2"],
            "uniqueContributions": ["contribution 1", "contribution 2"]
        }
    },
    "consensusFormation": {
        "pattern": "convergent|divergent|polarized|uniform",
        "description": "how the consensus developed"
    }
}

Consensus analysis to convert:
{{CONSENSUS_TEXT}}

Return ONLY the JSON object, no other text. Do NOT calculate percentages, scores, or any numerical metrics.`;
}
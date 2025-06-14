// Configuration Module
// Contains all constants, API keys, model definitions, and template strings

import { CONSENSUS_PROMPT_TEMPLATE } from '../prompts/consensus-prompt-template.js';

export const CONFIG = {
    get OPENROUTER_API_KEY() {
        return localStorage.getItem('OPENROUTER_API_KEY') || '';
    },
    OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};

// Available LLM Models for selection
export const SELECTABLE_LLMS = [
    // First 7 visible by default
    { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', maxContextTokens: 32000, maxOutputTokens: 32000 },
    { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1', maxContextTokens: 32768, maxOutputTokens: 32768 },
    { id: 'openai/o4-mini-high', name: 'O4 Mini High', maxContextTokens: 100000, maxOutputTokens: 100000 },
    { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B', maxContextTokens: 32000, maxOutputTokens: 32000 },
    { id: 'x-ai/grok-3-beta', name: 'Grok 3 Beta', maxContextTokens: 32000, maxOutputTokens: 32000 },
    { id: 'google/gemini-2.5-pro-preview', name: 'Gemini Pro 2.5', maxContextTokens: 16000, maxOutputTokens: 16000 },
    { id: 'mistralai/magistral-medium-2506', name: 'Magistral Medium', maxContextTokens: 32768, maxOutputTokens: 32768 },
    // Hidden models (shown with "Show More")
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', maxContextTokens: 64000, maxOutputTokens: 64000 },
    { id: 'openai/gpt-4.1', name: 'GPT-4.1', maxContextTokens: 100000, maxOutputTokens: 100000 },
    { id: 'openai/chatgpt-4o-latest', name: 'ChatGPT 4o', maxContextTokens: 4096, maxOutputTokens: 4096 },
    { id: 'google/gemini-2.5-flash-preview:thinking', name: 'Gemini 2.5 Flash Thinking', maxContextTokens: 16000, maxOutputTokens: 16000 }
];

// All models including consensus-only models
export const ALL_LLMS = [
    ...SELECTABLE_LLMS.map(model => {
        // Mark Gemini 2.5 Flash Thinking as the consensus model
        if (model.id === 'google/gemini-2.5-flash-preview:thinking') {
            return { ...model, isConsensusModel: true };
        }
        return model;
    })
];

// For backwards compatibility
export const AVAILABLE_LLMS = SELECTABLE_LLMS;

// Hardcoded anonymous codenames for models (to reduce bias)
export const MODEL_CODENAMES = {
    'anthropic/claude-opus-4': 'llm-!',
    'deepseek/deepseek-r1-0528': 'llm-@',
    'openai/o4-mini-high': 'llm-#',
    'qwen/qwen3-30b-a3b:free': 'llm-$',
    'x-ai/grok-3-beta': 'llm-%',
    'google/gemini-2.5-pro-preview': 'llm-^',
    'mistralai/magistral-medium-2506': 'llm-+',
    'anthropic/claude-sonnet-4': 'llm-&',
    'openai/gpt-4.1': 'llm-*',
    'openai/chatgpt-4o-latest': 'llm-(',
    'google/gemini-2.5-flash-preview:thinking': 'llm-)'
};

// Loading message arrays for different stages
export const LOADING_MESSAGES = {
    INDIVIDUAL: [
        "Querying the Shoggoths...",
        "Awakening the Digital Oracles...",
        "Summoning AI Wisdom...",
        "Consulting the Silicon Sages...",
        "Polling the Neural Networks...",
        "Gathering Digital Opinions...",
        "Waking the Model Collective...",
        "Channeling AI Consciousness...",
        "Invoking Machine Intelligence..."
    ],
    CONSENSUS: [
        "Engaging in AI Democracy...",
        "Assembling the Truth Tables...",
        "Polling the Robot Council...",
        "Synthesizing Digital Wisdom...",
        "Mediating AI Disagreements...",
        "Forging Computational Consensus...",
        "Harmonizing Neural Opinions...",
        "Building Algorithmic Agreement...",
        "Orchestrating Digital Debate..."
    ],
    JSON: [
        "Structuring the Data Matrix...",
        "Parsing Digital DNA...",
        "Compiling Insight Algorithms...",
        "Crystallizing Information...",
        "Weaving Data Tapestries...",
        "Architecting Knowledge...",
        "Encoding Wisdom Patterns...",
        "Organizing Thought Structures...",
        "Blueprinting Intelligence..."
    ]
};

// Re-export the consensus prompt template
export { CONSENSUS_PROMPT_TEMPLATE };

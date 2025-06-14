// Loading Animation Module
// Manages all loading states and animations throughout the application

import { LOADING_MESSAGES } from './config.js';

// Loading animation state
let loadingInterval = null;
let currentMessageIndex = 0;
let individualLoadingIntervals = {};

// Global loading animation for submit button (with pulse effect)
export function startButtonPulse(buttonElement) {
    if (buttonElement) {
        buttonElement.classList.add('clicked');
        // Remove the class after animation completes
        setTimeout(() => {
            buttonElement.classList.remove('clicked');
        }, 300);
    }
}

// Individual card loading animations
export function startIndividualLoadingAnimation(cardIndex, modelName) {
    const cardElement = document.getElementById(`response-card-${cardIndex}`);
    if (!cardElement) return;

    const contentElement = cardElement.querySelector('.response-card-content');
    if (!contentElement) return;

    // Create loading message
    const loadingHtml = `
        <div class="loading-message compact" id="loading-${cardIndex}">
            <div class="spinner-dark"></div>
            <span class="loading-text" id="loading-text-${cardIndex}">Querying ${modelName}...</span>
        </div>
    `;
    
    contentElement.innerHTML = loadingHtml;

    // Start rotating through loading messages
    let messageIndex = 0;
    const messages = LOADING_MESSAGES.INDIVIDUAL;
    
    individualLoadingIntervals[cardIndex] = setInterval(() => {
        const textElement = document.getElementById(`loading-text-${cardIndex}`);
        if (textElement) {
            textElement.classList.add('fade-out');
            
            setTimeout(() => {
                if (textElement) {
                    messageIndex = (messageIndex + 1) % messages.length;
                    textElement.textContent = messages[messageIndex];
                    textElement.classList.remove('fade-out');
                    textElement.classList.add('fade-in');
                    
                    setTimeout(() => {
                        if (textElement) {
                            textElement.classList.remove('fade-in');
                        }
                    }, 300);
                }
            }, 150);
        }
    }, 2000);
}

export function stopIndividualLoadingAnimation(cardIndex) {
    if (individualLoadingIntervals[cardIndex]) {
        clearInterval(individualLoadingIntervals[cardIndex]);
        delete individualLoadingIntervals[cardIndex];
    }
}

export function stopAllIndividualLoadingAnimations() {
    Object.keys(individualLoadingIntervals).forEach(cardIndex => {
        stopIndividualLoadingAnimation(cardIndex);
    });
}

// Consensus loading animation
export function startConsensusLoading() {
    const loadingElement = document.getElementById('consensusLoading');
    const textElement = document.getElementById('consensusLoadingText');
    
    if (!loadingElement || !textElement) return;
    
    loadingElement.style.display = 'block';
    
    let messageIndex = 0;
    const messages = LOADING_MESSAGES.CONSENSUS;
    
    // Start with first message
    textElement.textContent = messages[messageIndex];
    
    // Rotate through messages
    loadingInterval = setInterval(() => {
        textElement.classList.add('fade-out');
        
        setTimeout(() => {
            if (textElement) {
                messageIndex = (messageIndex + 1) % messages.length;
                textElement.textContent = messages[messageIndex];
                textElement.classList.remove('fade-out');
                textElement.classList.add('fade-in');
                
                setTimeout(() => {
                    if (textElement) {
                        textElement.classList.remove('fade-in');
                    }
                }, 300);
            }
        }, 150);
    }, 2500);
}

export function stopConsensusLoading() {
    const loadingElement = document.getElementById('consensusLoading');
    
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// JSON processing loading animation
export function startJsonLoading() {
    const loadingElement = document.getElementById('jsonLoading');
    const textElement = document.getElementById('jsonLoadingText');
    
    if (!loadingElement || !textElement) return;
    
    loadingElement.style.display = 'block';
    
    let messageIndex = 0;
    const messages = LOADING_MESSAGES.JSON;
    
    // Start with first message
    textElement.textContent = messages[messageIndex];
    
    // Rotate through messages
    loadingInterval = setInterval(() => {
        textElement.classList.add('fade-out');
        
        setTimeout(() => {
            if (textElement) {
                messageIndex = (messageIndex + 1) % messages.length;
                textElement.textContent = messages[messageIndex];
                textElement.classList.remove('fade-out');
                textElement.classList.add('fade-in');
                
                setTimeout(() => {
                    if (textElement) {
                        textElement.classList.remove('fade-in');
                    }
                }, 300);
            }
        }, 150);
    }, 2000);
}

export function stopJsonLoading() {
    const loadingElement = document.getElementById('jsonLoading');
    
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Utility function to stop all loading animations
export function stopAllLoadingAnimations() {
    stopConsensusLoading();
    stopJsonLoading();
    stopAllIndividualLoadingAnimations();
}
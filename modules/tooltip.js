// Simple Tooltip Module
// Shows tooltips with 1 second delay on hover

let tooltipElement = null;
let tooltipTimeout = null;

export function initTooltips() {
    console.log('Initializing tooltips...');
    
    // Create tooltip element if it doesn't exist
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'tooltip';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
        
        // Verify it was added
        if (!document.body.contains(tooltipElement)) {
            console.error('Failed to add tooltip element to body');
            return;
        }
    }
    
    // Add event listeners using event delegation
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    
    console.log('Tooltip system initialized, element:', tooltipElement);
}

function handleMouseOver(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    
    console.log('Tooltip hover detected:', target.getAttribute('data-tooltip'));
    
    // Clear any existing timeout
    clearTimeout(tooltipTimeout);
    
    // Set timeout for 1 second
    tooltipTimeout = setTimeout(() => {
        showTooltip(target);
    }, 1000);
}

function handleMouseOut(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    
    // If the pointer is still inside the element (e.g., moving between child nodes), do not hide yet
    // e.relatedTarget is the element the pointer has entered
    // If it is still within the target, we ignore this event
    if (target.contains(e.relatedTarget)) {
        return;
    }
    
    // Clear timeout and hide tooltip
    clearTimeout(tooltipTimeout);
    hideTooltip();
}

function showTooltip(element) {
    const text = element.getAttribute('data-tooltip');
    if (!text) return;
    
    // Set tooltip text
    tooltipElement.textContent = text;

    // Ensure the hovered element can act as an anchoring context
    if (getComputedStyle(element).position === 'static') {
        element.style.position = 'relative';
    }

    // Append the tooltip directly to the hovered element
    element.appendChild(tooltipElement);

    tooltipElement.style.display = 'block';
    tooltipElement.classList.add('show');
}

function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.classList.remove('show');
        tooltipElement.style.display = 'none';
        // Detach the tooltip from the current parent so it can be reused
        if (tooltipElement.parentNode) {
            tooltipElement.parentNode.removeChild(tooltipElement);
        }
    }
}

// Export a function to refresh tooltips after dynamic content is added
export function refreshTooltips() {
    console.log('Tooltips refreshed for dynamic content');
}
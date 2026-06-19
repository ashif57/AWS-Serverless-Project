// DOM Elements
const shortenForm = document.getElementById('shortenForm');
const longUrlInput = document.getElementById('longUrl');
const toggleCustomIdBtn = document.getElementById('toggleCustomIdBtn');
const customIdFields = document.getElementById('customIdFields');
const customIdInput = document.getElementById('customId');
const domainPrefix = document.getElementById('domainPrefix');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = submitBtn.querySelector('.btn-text-content');
const spinner = submitBtn.querySelector('.spinner');

// Sections & Layout
const formSection = document.getElementById('formSection');
const resultSection = document.getElementById('resultSection');
const alertContainer = document.getElementById('alertContainer');
const alertText = document.getElementById('alertText');
const alertCloseBtn = document.getElementById('alertCloseBtn');

// Result Elements
const shortUrlOutput = document.getElementById('shortUrlOutput');
const originalUrlOutput = document.getElementById('originalUrlOutput');
const qrCodeImg = document.getElementById('qrCodeImg');
const qrPlaceholder = document.querySelector('.qr-loading-placeholder');
const copyBtn = document.getElementById('copyBtn');
const copyBtnText = document.getElementById('copyBtnText');
const copyIcon = document.getElementById('copyIcon');
const visitBtn = document.getElementById('visitBtn');
const resetFormBtn = document.getElementById('resetFormBtn');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const apiEndpointInput = document.getElementById('apiEndpointInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');

// State Variables
let apiEndpoint = '';
let apiKey = '';

// Default values (used as placeholders/mock fallbacks if not configured)
const PLACEHOLDER_ENDPOINT = 'https://a1b2c3d4.execute-api.us-east-1.amazonaws.com/prod';

// Initialize App
function init() {
    loadSettings();
    updateDomainPrefix();
    setupEventListeners();
}

// Load Settings from LocalStorage
function loadSettings() {
    apiEndpoint = localStorage.getItem('aws_api_endpoint') || '';
    apiKey = localStorage.getItem('aws_api_key') || '';
    
    // Set input values in modal
    apiEndpointInput.value = apiEndpoint;
    apiKeyInput.value = apiKey;
    
    // If not configured, show warning alert to guide user
    if (!apiEndpoint) {
        showAlert('Backend API is not configured. Click the settings gear at the top right to set your API Gateway URL.', 'info');
    }
}

// Save Settings to LocalStorage
function saveSettings() {
    const rawEndpoint = apiEndpointInput.value.trim();
    // Strip trailing slash if present
    apiEndpoint = rawEndpoint.endsWith('/') ? rawEndpoint.slice(0, -1) : rawEndpoint;
    apiKey = apiKeyInput.value.trim();

    localStorage.setItem('aws_api_endpoint', apiEndpoint);
    localStorage.setItem('aws_api_key', apiKey);

    updateDomainPrefix();
    closeModal();
    showAlert('API configuration saved successfully!', 'success');
}

// Reset Settings
function resetSettings() {
    localStorage.removeItem('aws_api_endpoint');
    localStorage.removeItem('aws_api_key');
    apiEndpoint = '';
    apiKey = '';
    apiEndpointInput.value = '';
    apiKeyInput.value = '';
    updateDomainPrefix();
    closeModal();
    showAlert('API settings reset. Please enter your API Gateway endpoint to execute requests.', 'info');
}

// Update prefix label for custom ID input
function updateDomainPrefix() {
    if (apiEndpoint) {
        try {
            const urlObj = new URL(apiEndpoint);
            // Show only hostname and stage path for cleanliness
            const displayPrefix = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '') + '/';
            domainPrefix.textContent = displayPrefix.length > 25 ? displayPrefix.substring(0, 22) + '.../' : displayPrefix;
            domainPrefix.title = displayPrefix;
        } catch (e) {
            domainPrefix.textContent = 'api-endpoint/';
        }
    } else {
        domainPrefix.textContent = 'short.en/';
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Custom ID accordion toggle
    toggleCustomIdBtn.addEventListener('click', () => {
        const isCollapsed = customIdFields.classList.contains('collapsed');
        const chevron = toggleCustomIdBtn.querySelector('.chevron-icon');
        
        if (isCollapsed) {
            customIdFields.classList.remove('collapsed');
            customIdFields.classList.add('expanded');
            chevron.classList.add('rotated');
        } else {
            customIdFields.classList.remove('expanded');
            customIdFields.classList.add('collapsed');
            chevron.classList.remove('rotated');
            customIdInput.value = ''; // Reset when hidden
        }
    });

    // Form submission
    shortenForm.addEventListener('submit', handleFormSubmit);

    // Alert Close
    alertCloseBtn.addEventListener('click', hideAlert);

    // Modal Control
    settingsBtn.addEventListener('click', openModal);
    closeSettingsModal.addEventListener('click', closeModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });

    saveSettingsBtn.addEventListener('click', saveSettings);
    resetSettingsBtn.addEventListener('click', resetSettings);

    // Copy to clipboard
    copyBtn.addEventListener('click', copyToClipboard);

    // Reset Form (Shorten another URL)
    resetFormBtn.addEventListener('click', resetForm);
}

// Open Modal
function openModal() {
    settingsModal.classList.remove('hidden');
    apiEndpointInput.focus();
}

// Close Modal
function closeModal() {
    settingsModal.classList.add('hidden');
}

// Show Alerts
function showAlert(message, type = 'error') {
    alertText.textContent = message;
    alertContainer.className = 'alert-container'; // Reset classes
    
    if (type === 'success') {
        alertContainer.style.background = 'rgba(16, 185, 129, 0.15)';
        alertContainer.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        alertContainer.style.color = 'var(--text-success)';
    } else if (type === 'info') {
        alertContainer.style.background = 'rgba(99, 102, 241, 0.15)';
        alertContainer.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        alertContainer.style.color = 'var(--text-primary)';
    } else {
        // Error default
        alertContainer.style.background = 'rgba(248, 113, 113, 0.15)';
        alertContainer.style.borderColor = 'rgba(248, 113, 113, 0.3)';
        alertContainer.style.color = 'var(--text-error)';
    }
    
    alertContainer.classList.remove('hidden');
}

// Hide Alerts
function hideAlert() {
    alertContainer.classList.add('hidden');
}

// Handle URL Shortening Request
async function handleFormSubmit(e) {
    e.preventDefault();
    hideAlert();

    const longUrl = longUrlInput.value.trim();
    const customId = customIdInput.value.trim();

    // Validate configuration
    if (!apiEndpoint) {
        showAlert('Please set your API Gateway URL in Settings (gear icon) before shortening.', 'error');
        openModal();
        return;
    }

    // Set UI to loading state
    setLoading(true);

    try {
        const payload = { url: longUrl };
        if (customId) {
            payload.custom_id = customId;
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        // Call the lambda1 (Create) backend
        const response = await fetch(`${apiEndpoint}/create`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            // Success! Display results
            showResult(data.short_id, data.original_url);
        } else {
            // Handle logical errors
            if (response.status === 409) {
                showAlert(data.error || `Custom ID '${customId}' is already taken. Please choose another one.`, 'error');
            } else {
                showAlert(data.error || 'Server error. Please verify your backend configuration and CORS settings.', 'error');
            }
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showAlert('Network request failed. Ensure CORS is enabled on API Gateway, your endpoint URL is correct, and you are connected to the internet.', 'error');
    } finally {
        setLoading(false);
    }
}

// Set Loading State
function setLoading(loading) {
    if (loading) {
        submitBtn.disabled = true;
        submitBtnText.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        submitBtn.disabled = false;
        submitBtnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

// Display Shortened Link
function showResult(shortId, originalUrl) {
    // Hide form, show result
    formSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    // Build absolute redirection link
    const shortUrl = `${apiEndpoint}/${shortId}`;
    shortUrlOutput.value = shortUrl;
    
    // Set up original link
    originalUrlOutput.href = originalUrl;
    originalUrlOutput.textContent = originalUrl.length > 50 ? originalUrl.substring(0, 47) + '...' : originalUrl;
    originalUrlOutput.title = originalUrl;

    // Set up Visit button
    visitBtn.href = shortUrl;

    // Load QR Code dynamically
    qrPlaceholder.classList.remove('hidden');
    qrCodeImg.classList.add('hidden');

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}`;
    
    qrCodeImg.onload = () => {
        qrPlaceholder.classList.add('hidden');
        qrCodeImg.classList.remove('hidden');
    };
    qrCodeImg.src = qrUrl;
}

// Copy to Clipboard with Feedback
function copyToClipboard() {
    const textToCopy = shortUrlOutput.value;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
        // Visual Success Feedback
        copyBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        copyBtn.style.color = 'var(--text-success)';
        copyBtnText.textContent = 'Copied!';
        
        // Save old SVG path
        const originalSvgContent = copyIcon.innerHTML;
        // Swap to checkmark icon
        copyIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';

        setTimeout(() => {
            // Restore normal state
            copyBtn.style.borderColor = '';
            copyBtn.style.color = '';
            copyBtnText.textContent = 'Copy';
            copyIcon.innerHTML = originalSvgContent;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showAlert('Could not automatically copy to clipboard. Please copy manually.', 'info');
    });
}

// Reset Form State
function resetForm() {
    shortenForm.reset();
    
    // Collapse custom ID fields
    customIdFields.classList.remove('expanded');
    customIdFields.classList.add('collapsed');
    toggleCustomIdBtn.querySelector('.chevron-icon').classList.remove('rotated');
    
    // Toggle displays
    resultSection.classList.add('hidden');
    formSection.classList.remove('hidden');
    
    // Clear QR code source
    qrCodeImg.src = '';
    
    // Focus URL input
    longUrlInput.focus();
}

// Start Application
window.addEventListener('DOMContentLoaded', init);

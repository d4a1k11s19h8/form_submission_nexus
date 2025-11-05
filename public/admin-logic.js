document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const generatorSection = document.getElementById('generator-section');
    const loginForm = document.getElementById('login-form');
    const generatorForm = document.getElementById('generator-form');
    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    
    // --- NEW ELEMENTS ---
    const copyBtn = document.getElementById('copy-btn');
    const generatedLinkEl = document.getElementById('generated-link');
    
    let adminPassword = ''; // We'll store this after login

    // Show the login form first
    loginSection.style.display = 'block';

    // Handle Admin Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();
            
            if (data.success) {
                adminPassword = password; // Store the password for future requests
                loginSection.style.display = 'none';
                generatorSection.style.display = 'block';
                errorDiv.textContent = '';
            } else {
                errorDiv.textContent = data.message || 'Login failed.';
            }
        } catch (err) {
            errorDiv.textContent = 'An error occurred.';
        }
    });

    // Handle Token Generation
    generatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const brandName = document.getElementById('brandName').value;
        const button = generatorForm.querySelector('button');
        button.disabled = true;
        button.textContent = 'Generating...';
        
        try {
            const response = await fetch('/admin-generate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the password and brand name
                body: JSON.stringify({ password: adminPassword, brandName }) 
            });
            
            const data = await response.json();
            
            if (data.success) {
                // --- UPDATED ---
                // Populate the new <code> element
                generatedLinkEl.textContent = data.link;
                resultDiv.style.display = 'flex'; // Use flex to show it
                errorDiv.textContent = '';
                generatorForm.reset();
            } else {
                errorDiv.textContent = data.message || 'Generation failed.';
                resultDiv.style.display = 'none';
            }
        } catch (err) {
            errorDiv.textContent = 'An error occurred.';
        } finally {
            button.disabled = false;
            button.textContent = 'Generate';
        }
    });

    // --- NEW EVENT LISTENER FOR COPY BUTTON ---
    copyBtn.addEventListener('click', () => {
        const linkText = generatedLinkEl.textContent;
        if (!linkText) return;

        navigator.clipboard.writeText(linkText).then(() => {
            // Provide visual feedback
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            errorDiv.textContent = 'Failed to copy link.';
        });
    });
});
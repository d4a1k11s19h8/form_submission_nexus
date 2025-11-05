document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const generatorSection = document.getElementById('generator-section');
    const generatorForm = document.getElementById('generator-form');
    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    const copyBtn = document.getElementById('copy-btn');
    const generatedLinkEl = document.getElementById('generated-link');
    const userEmailEl = document.getElementById('user-email');

    // Check if user is already logged in
    (async () => {
        try {
            const response = await fetch('/admin/auth-status');
            const data = await response.json();
            
            if (data.authenticated) {
                // User is logged in, show generator
                loginSection.style.display = 'none';
                generatorSection.style.display = 'block';
                userEmailEl.textContent = `Logged in as: ${data.user.email}`;
            } else {
                // User is not logged in, show login button
                loginSection.style.display = 'block';
                generatorSection.style.display = 'none';
            }
        } catch (err) {
            loginSection.style.display = 'block';
        }
    })();

    // Handle Token Generation
    generatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const brandName = document.getElementById('brandName').value;
        const button = generatorForm.querySelector('button');
        button.disabled = true;
        button.textContent = 'Generating...';
        
        try {
            // No password needed, the server knows we are logged in via our session
            const response = await fetch('/admin-generate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandName }) 
            });
            
            const data = await response.json();
            
            if (data.success) {
                generatedLinkEl.textContent = data.link;
                resultDiv.style.display = 'flex';
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

    // Handle Copy Button
    copyBtn.addEventListener('click', () => {
        const linkText = generatedLinkEl.textContent;
        if (!linkText) return;

        navigator.clipboard.writeText(linkText).then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            errorDiv.textContent = 'Failed to copy link.';
        });
    });
});

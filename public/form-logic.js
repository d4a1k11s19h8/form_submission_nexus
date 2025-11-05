document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('sponsor-form');
    const previewSection = document.getElementById('preview-section');
    const successSection = document.getElementById('success-section');
    
    const previewBtn = document.getElementById('preview-btn');
    const editBtn = document.getElementById('edit-btn');
    const submitBtn = document.getElementById('submit-btn');

    const signatureInput = document.getElementById('signature');
    const signaturePreview = document.getElementById('signature-preview');
    const screenshotInput = document.getElementById('paymentScreenshot');
    const screenshotPreview = document.getElementById('screenshot-preview');

    let signatureFile = null;
    let screenshotFile = null;

    // Handle Signature file
    signatureInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
                alert('Invalid signature file type. Please upload a JPG or PNG.');
                signatureInput.value = ''; signatureFile = null; return;
            }
            if (file.size > 2 * 1024 * 1024) { // 2MB Check
                alert('Signature file is too large (Max 2MB).');
                signatureInput.value = ''; signatureFile = null; return;
            }
            signatureFile = file;
            const reader = new FileReader();
            reader.onload = (event) => { signaturePreview.src = event.target.result; }
            reader.readAsDataURL(signatureFile);
        }
    });

    // Handle Screenshot file
    screenshotInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
                alert('Invalid screenshot file type. Please upload a JPG or PNG.');
                screenshotInput.value = ''; screenshotFile = null; return;
            }
            if (file.size > 2 * 1024 * 1024) { // 2MB Check
                alert('Screenshot file is too large (Max 2MB).');
                screenshotInput.value = ''; screenshotFile = null; return;
            }
            screenshotFile = file;
            const reader = new FileReader();
            reader.onload = (event) => { screenshotPreview.src = event.target.result; }
            reader.readAsDataURL(screenshotFile);
        }
    });

    // SHOW PREVIEW
    previewBtn.addEventListener('click', () => {
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        document.getElementById('preview-name').textContent = document.getElementById('name').value;
        document.getElementById('preview-company').textContent = document.getElementById('company').value;
        document.getElementById('preview-designation').textContent = document.getElementById('designation').value;
        document.getElementById('preview-amount').textContent = document.getElementById('amount').value;
        document.getElementById('preview-method').textContent = document.getElementById('paymentMethod').value;
        document.getElementById('preview-collectedBy').textContent = document.getElementById('collectedBy').value;
        document.getElementById('preview-collectedOn').textContent = document.getElementById('collectedOn').value;
        form.style.display = 'none';
        previewSection.style.display = 'block';
    });

    // GO BACK TO EDIT
    editBtn.addEventListener('click', () => {
        form.style.display = 'block';
        previewSection.style.display = 'none';
    });

    // SUBMIT TO SERVER
    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('company', document.getElementById('company').value);
        formData.append('designation', document.getElementById('designation').value);
        formData.append('amount', document.getElementById('amount').value);
        formData.append('paymentMethod', document.getElementById('paymentMethod').value);
        formData.append('collectedBy', document.getElementById('collectedBy').value);
        formData.append('collectedOn', document.getElementById('collectedOn').value);
        
        if (signatureFile) {
            formData.append('signature', signatureFile);
        }
        if (screenshotFile) {
            formData.append('paymentScreenshot', screenshotFile);
        }
        
        const token = new URLSearchParams(window.location.search).get('token');
        formData.append('token', token);

        try {
            const response = await fetch('/submit-form', {
                method: 'POST',
                body: formData 
            });

            const data = await response.json();

            if (data.success) {
                previewSection.style.display = 'none';
                successSection.style.display = 'block';
                document.getElementById('submission-id').textContent = data.submissionID;
                const downloadLink = document.getElementById('download-link');
                downloadLink.href = `/download-user-copy/${data.filename}`;
                downloadLink.download = data.filename;
            } else {
                alert(`Error: ${data.message || 'Submission failed. Please try again.'}`);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm & Submit';
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('A critical error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm & Submit';
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('sponsor-form');
    const previewSection = document.getElementById('preview-section');
    const successSection = document.getElementById('success-section'); // New
    
    const previewBtn = document.getElementById('preview-btn');
    const editBtn = document.getElementById('edit-btn');
    const submitBtn = document.getElementById('submit-btn');
    const signatureInput = document.getElementById('signature');
    const signaturePreview = document.getElementById('signature-preview');

    let signatureFile = null;

    // Handle file selection for preview
    signatureInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
                alert('Invalid file type. Please upload a JPG or PNG.');
                signatureInput.value = '';
                signaturePreview.src = '';
                signatureFile = null;
                return;
            }
            signatureFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                signaturePreview.src = event.target.result;
            }
            reader.readAsDataURL(signatureFile);
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

    // --- SUBMIT TO SERVER (UPDATED) ---
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

        try {
            const response = await fetch('/submit-form', {
                method: 'POST',
                body: formData 
            });

            if (response.ok) {
                // We are now expecting JSON back, not just text
                const data = await response.json();

                if (data.success) {
                    // --- SHOW SUCCESS SCREEN ---
                    previewSection.style.display = 'none';
                    successSection.style.display = 'block';
                    
                    // Set the Submission ID ("key")
                    document.getElementById('submission-id').textContent = data.submissionID;
                    
                    // Set the download link for the user's copy
                    const downloadLink = document.getElementById('download-link');
                    downloadLink.href = `/download-user-copy/${data.filename}`;
                    downloadLink.download = data.filename; // Sets the filename for the download
                } else {
                    alert('Submission failed. Please try again.');
                }
            } else {
                alert('Server error. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm & Submit';
        }
    });
});
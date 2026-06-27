// MergeMail Frontend Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let recipientsData = []; // Array of objects containing recipient details
  let csvHeaders = [];     // List of headers detected in the CSV
  let currentPreviewIndex = 0;
  let activeInputField = null; // Tracks if subject or body was focused last
  let uploadedAttachments = {}; // Map of filename -> File object
  let inlineImages = {}; // key: cid, value: { filename, content (base64), contentType }
  let pendingImageFile = null;
  let activeImageModalTab = 'local'; // 'local' or 'url'
  let authToken = localStorage.getItem('merge_mail_token') || null;
  let heartbeatInterval = null;
  
  // Sending state variables
  let isSending = false;
  let isPaused = false;
  let sendQueue = [];
  let currentQueueIndex = 0;
  let successCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let sendingTimer = null;
  let currentDelay = 1.5; // Seconds

  // --- Element Selectors ---
  // Header / Auth
  const loginScreen = document.getElementById('login-screen');
  const userDisplay = document.getElementById('user-display');
  const btnLogout = document.getElementById('btn-logout');

  // Auth Views
  const loginView = document.getElementById('login-view');
  const signupView = document.getElementById('signup-view');
  const verifyView = document.getElementById('verify-view');

  // Login Form Selectors
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const loginErrorText = document.getElementById('login-error-text');

  // Signup Form Selectors
  const signupForm = document.getElementById('signup-form');
  const signupUsernameInput = document.getElementById('signup-username');
  const signupEmailInput = document.getElementById('signup-email');
  const signupPasswordInput = document.getElementById('signup-password');
  const signupError = document.getElementById('signup-error');
  const signupErrorText = document.getElementById('signup-error-text');

  // Verify Form Selectors
  const verifyForm = document.getElementById('verify-form');
  const verifyCodeInput = document.getElementById('verify-code');
  const verifyError = document.getElementById('verify-error');
  const verifyErrorText = document.getElementById('verify-error-text');
  const verifyEmailDisplay = document.getElementById('verify-email-display');

  // Toggle Links
  const linkGotoSignup = document.getElementById('link-goto-signup');
  const linkGotoLogin = document.getElementById('link-goto-login');
  const linkBackToSignup = document.getElementById('link-back-to-signup');
  
  // Sidebar (Recipients & Placeholders)
  const csvDropzone = document.getElementById('csv-dropzone');
  const csvFileInput = document.getElementById('csv-file-input');
  const csvSummary = document.getElementById('csv-summary');
  const recipientCountEl = document.getElementById('recipient-count');
  const columnsCountEl = document.getElementById('columns-count');
  const btnViewRecipients = document.getElementById('btn-view-recipients');
  const downloadSampleCsvLink = document.getElementById('download-sample-csv');
  const placeholdersList = document.getElementById('placeholders-list');

  // Attachments Selectors
  const attachmentsDropzone = document.getElementById('attachments-dropzone');
  const attachmentsFileInput = document.getElementById('attachments-file-input');
  const attachmentsListContainer = document.getElementById('attachments-list-container');
  const attachmentsCountEl = document.getElementById('attachments-count');
  const attachmentsList = document.getElementById('attachments-list');
  const btnClearAttachments = document.getElementById('btn-clear-attachments');

  // Tabs
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const tabBtnPreview = document.getElementById('tab-btn-preview');
  const tabBtnSend = document.getElementById('tab-btn-send');

  // Tab 1: Composer
  const emailFromName = document.getElementById('email-from-name');
  const emailSubject = document.getElementById('email-subject');
  const emailBody = document.getElementById('email-body');

  // Tab 2: Live Preview
  const btnPrevRecipient = document.getElementById('btn-prev-recipient');
  const btnNextRecipient = document.getElementById('btn-next-recipient');
  const previewCurrentIndex = document.getElementById('preview-current-index');
  const previewTotalCount = document.getElementById('preview-total-count');
  const previewRecipientDropdown = document.getElementById('preview-recipient-dropdown');
  const previewFromHeader = document.getElementById('preview-from-header');
  const previewToHeader = document.getElementById('preview-to-header');
  const previewSubjectHeader = document.getElementById('preview-subject-header');
  const previewRenderedBody = document.getElementById('preview-rendered-body');

  // Tab 3: Sending Dashboard
  const statTotal = document.getElementById('stat-total');
  const statPending = document.getElementById('stat-pending');
  const statSuccess = document.getElementById('stat-success');
  const statFailed = document.getElementById('stat-failed');
  const sendingStatusLabel = document.getElementById('sending-status-label');
  const sendingPercentageLabel = document.getElementById('sending-percentage-label');
  const sendingProgressBar = document.getElementById('sending-progress-bar');
  const sendingDelaySlider = document.getElementById('sending-delay');
  const delayValEl = document.getElementById('delay-val');
  const btnStartSending = document.getElementById('btn-start-sending');
  const btnPauseSending = document.getElementById('btn-pause-sending');
  const btnStopSending = document.getElementById('btn-stop-sending');
  const queueLogsTbody = document.getElementById('queue-logs-tbody');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  const recipientsModal = document.getElementById('recipients-modal');
  const btnCloseRecipients = document.getElementById('btn-close-recipients');
  const btnCloseRecipientsFooter = document.getElementById('btn-close-recipients-footer');
  const recipientsTableThead = document.getElementById('recipients-table-thead');
  const recipientsTableTbody = document.getElementById('recipients-table-tbody');
  const recipientsModalCount = document.getElementById('recipients-modal-count');

  // Inline Images element selectors
  const btnInsertImage = document.getElementById('btn-insert-image');
  const btnSidebarAddImage = document.getElementById('btn-sidebar-add-image');
  const imageModal = document.getElementById('image-modal');
  const btnCloseImageModal = document.getElementById('btn-close-image-modal');
  const btnCancelImageModal = document.getElementById('btn-cancel-image-modal');
  const tabBtnLocalImage = document.getElementById('tab-btn-local-image');
  const tabBtnUrlImage = document.getElementById('tab-btn-url-image');
  const modalSecLocal = document.getElementById('modal-sec-local');
  const modalSecUrl = document.getElementById('modal-sec-url');
  const imageFileInput = document.getElementById('image-file-input');
  const imageDropzone = document.getElementById('image-dropzone');
  const imageUploadPreviewContainer = document.getElementById('image-upload-preview-container');
  const imageUploadPreview = document.getElementById('image-upload-preview');
  const imageUploadFilename = document.getElementById('image-upload-filename');
  const imageCidInput = document.getElementById('image-cid-input');
  const imageUrlInput = document.getElementById('image-url-input');
  const imageAltInput = document.getElementById('image-alt-input');
  const btnInsertImageSubmit = document.getElementById('btn-insert-image-submit');
  const inlineImagesListContainer = document.getElementById('inline-images-list-container');
  const inlineImagesList = document.getElementById('inline-images-list');

  // --- Initial Setup & Load Cache ---
  checkSession();
  setupSampleCSVDownload();

  // Track focused field for placeholder insertion
  emailSubject.addEventListener('focus', () => activeInputField = emailSubject);
  emailBody.addEventListener('focus', () => activeInputField = emailBody);

  // Default focus to body if none was selected
  if (!activeInputField) {
    activeInputField = emailBody;
  }

  // --- Tab Navigation Trigger ---
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetTab = link.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    tabLinks.forEach(lnk => {
      if (lnk.getAttribute('data-tab') === tabId) {
        lnk.classList.add('active');
      } else {
        lnk.classList.remove('active');
      }
    });

    tabContents.forEach(cnt => {
      if (cnt.id === tabId) {
        cnt.classList.add('active');
      } else {
        cnt.classList.remove('active');
      }
    });

    // Run tab-specific view updates
    if (tabId === 'tab-preview') {
      updateLivePreview();
    }
  }

  // --- Modal Utilities ---
  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
  }
  
  // Close modals on clicking outside card
  window.addEventListener('click', (e) => {
    if (e.target === recipientsModal) closeModal(recipientsModal);
  });

  // --- Authentication System ---
  function showLogin(show) {
    if (show) {
      loginScreen.classList.remove('hidden');
      loginView.classList.remove('hidden');
      signupView.classList.add('hidden');
      verifyView.classList.add('hidden');
      
      // Clear errors
      loginError.classList.add('hidden');
      signupError.classList.add('hidden');
      verifyError.classList.add('hidden');
      
      loginUsernameInput.focus();
    } else {
      loginScreen.classList.add('hidden');
    }
  }

  async function checkSession() {
    if (!authToken) {
      showLogin(true);
      return;
    }
    try {
      const response = await fetch('/api/auth/session-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        userDisplay.textContent = data.username;
        showLogin(false);
        startHeartbeat();
      } else {
        // Token invalid/expired
        authToken = null;
        localStorage.removeItem('merge_mail_token');
        showLogin(true);
      }
    } catch (err) {
      console.error('Session check failed:', err);
      if (!authToken) showLogin(true);
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    sendHeartbeat();
    // Heartbeat every 30 seconds
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  async function sendHeartbeat() {
    if (!authToken) return;
    try {
      await fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      });
    } catch (err) {
      console.error('Heartbeat ping failed:', err);
    }
  }

  // Handle Login submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    
    loginError.classList.add('hidden');
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        authToken = data.token;
        localStorage.setItem('merge_mail_token', data.token);
        userDisplay.textContent = data.username;
        
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        
        showLogin(false);
        startHeartbeat();
      } else {
        loginErrorText.textContent = data.error || 'Invalid credentials.';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      loginErrorText.textContent = 'Server connection failed.';
      loginError.classList.remove('hidden');
    }
  });

  // Toggle Links Event Listeners
  linkGotoSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.classList.add('hidden');
    verifyView.classList.add('hidden');
    signupView.classList.remove('hidden');
    
    // Clear errors
    signupError.classList.add('hidden');
    signupEmailInput.focus();
  });

  linkGotoLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupView.classList.add('hidden');
    verifyView.classList.add('hidden');
    loginView.classList.remove('hidden');
    
    // Clear errors
    loginError.classList.add('hidden');
    loginUsernameInput.focus();
  });

  linkBackToSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.classList.add('hidden');
    verifyView.classList.add('hidden');
    signupView.classList.remove('hidden');
    
    // Clear errors
    signupError.classList.add('hidden');
    signupEmailInput.focus();
  });

  // Handle Signup Start Submission
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = signupUsernameInput.value.trim();
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    
    signupError.classList.add('hidden');
    
    // Disable submit button during request
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending Code...';
    
    try {
      const response = await fetch('/api/auth/signup-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        verifyEmailDisplay.textContent = email;
        signupView.classList.add('hidden');
        verifyView.classList.remove('hidden');
        
        verifyCodeInput.value = '';
        verifyCodeInput.focus();
      } else {
        signupErrorText.textContent = data.error || 'Failed to start registration.';
        signupError.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      signupErrorText.textContent = 'Server connection failed.';
      signupError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // Handle Signup Verification Submission
  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = signupEmailInput.value.trim();
    const code = verifyCodeInput.value.trim();
    
    verifyError.classList.add('hidden');
    
    const submitBtn = verifyForm.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    
    try {
      const response = await fetch('/api/auth/signup-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        authToken = data.token;
        localStorage.setItem('merge_mail_token', data.token);
        userDisplay.textContent = data.username;
        
        // Reset forms
        signupUsernameInput.value = '';
        signupEmailInput.value = '';
        signupPasswordInput.value = '';
        verifyCodeInput.value = '';
        
        showLogin(false);
        startHeartbeat();
      } else {
        verifyErrorText.textContent = data.error || 'Invalid or expired verification code.';
        verifyError.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      verifyErrorText.textContent = 'Server connection failed.';
      verifyError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // Handle Logout
  btnLogout.addEventListener('click', async () => {
    stopHeartbeat();
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authToken })
        });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
    }
    authToken = null;
    localStorage.removeItem('merge_mail_token');
    userDisplay.textContent = '';
    showLogin(true);
  });

  // --- CSV parsing & Dropzone handlers ---
  csvDropzone.addEventListener('click', () => csvFileInput.click());

  csvDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvDropzone.classList.add('dragover');
  });

  csvDropzone.addEventListener('dragleave', () => {
    csvDropzone.classList.remove('dragover');
  });

  csvDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    csvDropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      csvFileInput.files = files;
      handleFileUpload(files[0]);
    }
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // --- Attachments dropzone handlers ---
  attachmentsDropzone.addEventListener('click', () => attachmentsFileInput.click());

  attachmentsDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    attachmentsDropzone.classList.add('dragover');
  });

  attachmentsDropzone.addEventListener('dragleave', () => {
    attachmentsDropzone.classList.remove('dragover');
  });

  attachmentsDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    attachmentsDropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleAttachmentsUpload(files);
    }
  });

  attachmentsFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleAttachmentsUpload(e.target.files);
    }
  });

  btnClearAttachments.addEventListener('click', (e) => {
    e.preventDefault();
    uploadedAttachments = {};
    renderAttachmentsList();
  });

  function handleAttachmentsUpload(fileList) {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      uploadedAttachments[file.name] = file;
    }
    renderAttachmentsList();
  }

  function renderAttachmentsList() {
    attachmentsList.innerHTML = '';
    const fileNames = Object.keys(uploadedAttachments);
    const count = fileNames.length;
    
    attachmentsCountEl.textContent = count;
    
    if (count > 0) {
      attachmentsListContainer.classList.remove('hidden');
      fileNames.forEach(name => {
        const file = uploadedAttachments[name];
        const sizeKB = Math.round(file.size / 1024);
        
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.background = 'rgba(255, 255, 255, 0.02)';
        li.style.border = '1px solid var(--border-color)';
        li.style.borderRadius = '6px';
        li.style.padding = '6px 10px';
        li.style.fontSize = '0.8rem';
        
        const nameSpan = document.createElement('span');
        nameSpan.style.color = 'var(--text-primary)';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.style.maxWidth = '180px';
        nameSpan.innerHTML = `<i class="fa-regular fa-file" style="margin-right: 6px; color: var(--primary);"></i>${name}`;
        
        const sizeSpan = document.createElement('span');
        sizeSpan.style.color = 'var(--text-muted)';
        sizeSpan.style.fontSize = '0.7rem';
        sizeSpan.style.marginLeft = 'auto';
        sizeSpan.style.paddingRight = '8px';
        sizeSpan.textContent = `${sizeKB} KB`;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.style.background = 'transparent';
        removeBtn.style.border = 'none';
        removeBtn.style.color = 'var(--color-danger)';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.outline = 'none';
        removeBtn.style.fontSize = '0.95rem';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.addEventListener('click', () => {
          delete uploadedAttachments[name];
          renderAttachmentsList();
        });
        
        li.appendChild(nameSpan);
        li.appendChild(sizeSpan);
        li.appendChild(removeBtn);
        attachmentsList.appendChild(li);
      });
    } else {
      attachmentsListContainer.classList.add('hidden');
    }
    
    if (recipientsData.length > 0) {
      updateLivePreview();
    }
  }

  // --- Inline Image Helper Functions & Event Listeners ---
  btnInsertImage.addEventListener('click', () => openImageModal());
  btnSidebarAddImage.addEventListener('click', () => openImageModal());

  btnCloseImageModal.addEventListener('click', () => closeImageModal());
  btnCancelImageModal.addEventListener('click', () => closeImageModal());
  window.addEventListener('click', (e) => {
    if (e.target === imageModal) closeImageModal();
  });

  function openImageModal() {
    resetImageModal();
    openModal(imageModal);
  }

  function closeImageModal() {
    closeModal(imageModal);
  }

  function resetImageModal() {
    pendingImageFile = null;
    imageFileInput.value = '';
    imageUploadPreviewContainer.classList.add('hidden');
    imageUploadPreview.src = '';
    imageUploadFilename.textContent = '';
    imageCidInput.value = '';
    imageUrlInput.value = '';
    imageAltInput.value = '';
    setImageModalTab('local');
  }

  function setImageModalTab(tab) {
    activeImageModalTab = tab;
    if (tab === 'local') {
      tabBtnLocalImage.classList.add('btn-primary');
      tabBtnLocalImage.classList.remove('btn-secondary');
      tabBtnUrlImage.classList.add('btn-secondary');
      tabBtnUrlImage.classList.remove('btn-primary');
      modalSecLocal.classList.remove('hidden');
      modalSecUrl.classList.add('hidden');
    } else {
      tabBtnUrlImage.classList.add('btn-primary');
      tabBtnUrlImage.classList.remove('btn-secondary');
      tabBtnLocalImage.classList.add('btn-secondary');
      tabBtnLocalImage.classList.remove('btn-primary');
      modalSecUrl.classList.remove('hidden');
      modalSecLocal.classList.add('hidden');
    }
  }

  tabBtnLocalImage.addEventListener('click', () => setImageModalTab('local'));
  tabBtnUrlImage.addEventListener('click', () => setImageModalTab('url'));

  imageDropzone.addEventListener('click', () => imageFileInput.click());

  imageDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropzone.classList.add('dragover');
  });

  imageDropzone.addEventListener('dragleave', () => {
    imageDropzone.classList.remove('dragover');
  });

  imageDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageSelection(files[0]);
    }
  });

  imageFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageSelection(e.target.files[0]);
    }
  });

  function handleImageSelection(file) {
    pendingImageFile = file;
    imageUploadFilename.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    
    const cleanName = file.name
      .split('.')[0]
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase();
    
    let candidateCid = cleanName || 'image';
    let suffix = 1;
    while (inlineImages[candidateCid]) {
      candidateCid = `${cleanName}_${suffix}`;
      suffix++;
    }
    imageCidInput.value = candidateCid;

    const reader = new FileReader();
    reader.onload = (e) => {
      imageUploadPreview.src = e.target.result;
      imageUploadPreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  btnInsertImageSubmit.addEventListener('click', async () => {
    if (activeImageModalTab === 'local') {
      if (!pendingImageFile) {
        alert('Please upload or drag an image first.');
        return;
      }
      
      const cid = imageCidInput.value.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      if (!cid) {
        alert('Please enter a valid Image ID.');
        return;
      }

      try {
        const base64Content = await getFileBase64(pendingImageFile);
        inlineImages[cid] = {
          filename: pendingImageFile.name,
          content: base64Content,
          contentType: pendingImageFile.type
        };

        insertHtmlAtCursor(emailBody, `<img src="cid:${cid}" style="max-width: 100%; height: auto;" />`);
        renderInlineImagesList();
        closeImageModal();
      } catch (err) {
        alert(`Failed to process image: ${err.message}`);
      }
    } else {
      const url = imageUrlInput.value.trim();
      if (!url) {
        alert('Please enter a valid image URL.');
        return;
      }
      const alt = imageAltInput.value.trim();
      const altAttr = alt ? ` alt="${alt}"` : '';

      insertHtmlAtCursor(emailBody, `<img src="${url}"${altAttr} style="max-width: 100%; height: auto;" />`);
      closeImageModal();
    }
  });

  function insertHtmlAtCursor(textarea, htmlText) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalValue = textarea.value;
    textarea.value = originalValue.substring(0, start) + htmlText + originalValue.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + htmlText.length;
    textarea.focus();
    updateLivePreview();
  }

  function renderInlineImagesList() {
    inlineImagesList.innerHTML = '';
    const cids = Object.keys(inlineImages);
    
    if (cids.length > 0) {
      inlineImagesListContainer.classList.remove('hidden');
      cids.forEach(cid => {
        const img = inlineImages[cid];
        const li = document.createElement('li');
        li.className = 'inline-image-item';
        
        const thumb = document.createElement('img');
        thumb.className = 'inline-image-thumb';
        thumb.src = `data:${img.contentType};base64,${img.content}`;
        
        const info = document.createElement('div');
        info.className = 'inline-image-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'inline-image-name';
        nameSpan.textContent = img.filename;
        
        const cidSpan = document.createElement('span');
        cidSpan.className = 'inline-image-cid';
        cidSpan.textContent = `cid:${cid}`;
        
        info.appendChild(nameSpan);
        info.appendChild(cidSpan);
        
        const actions = document.createElement('div');
        actions.className = 'inline-image-actions';
        
        const btnInsert = document.createElement('button');
        btnInsert.type = 'button';
        btnInsert.className = 'inline-image-btn';
        btnInsert.title = 'Insert into template';
        btnInsert.innerHTML = '<i class="fa-solid fa-square-plus"></i>';
        btnInsert.addEventListener('click', () => {
          insertHtmlAtCursor(emailBody, `<img src="cid:${cid}" style="max-width: 100%; height: auto;" />`);
        });
        
        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'inline-image-btn delete';
        btnDelete.title = 'Delete image';
        btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btnDelete.addEventListener('click', () => {
          delete inlineImages[cid];
          renderInlineImagesList();
          updateLivePreview();
        });
        
        actions.appendChild(btnInsert);
        actions.appendChild(btnDelete);
        
        li.appendChild(thumb);
        li.appendChild(info);
        li.appendChild(actions);
        
        inlineImagesList.appendChild(li);
      });
    } else {
      inlineImagesListContainer.classList.add('hidden');
    }
  }

  function handleFileUpload(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: function(results) {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
          processParsedData(results.data);
        },
        error: function(err) {
          alert('Failed to parse CSV file: ' + err.message);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          processParsedData(jsonData);
        } catch (err) {
          alert('Failed to parse Excel file: ' + err.message);
        }
      };
      reader.onerror = function() {
        alert('Error reading Excel file.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Invalid file format. Please upload a .csv, .xlsx, or .xls file.');
    }
  }

  function processParsedData(data) {
    if (!data || data.length === 0) {
      alert('The uploaded file contains no data.');
      return;
    }

    // Validate "Email" column (case insensitive)
    const headers = Object.keys(data[0]);
    const emailHeader = headers.find(h => h.toLowerCase() === 'email');

    if (!emailHeader) {
      alert('Error: Recipient list must contain an "Email" column (case-insensitive).');
      return;
    }

    // Normalize email header to standard "Email"
    recipientsData = data.map(row => {
      const newRow = {};
      headers.forEach(h => {
        if (h.toLowerCase() === 'email') {
          newRow['Email'] = String(row[h]).trim();
        } else {
          newRow[h] = row[h];
        }
      });
      return newRow;
    });

    // Store cleaned headers
    csvHeaders = headers.filter(h => h.toLowerCase() !== 'email');
    csvHeaders.unshift('Email'); // Always keep email first

    // Update UI
    recipientCountEl.textContent = recipientsData.length;
    columnsCountEl.textContent = csvHeaders.length;
    csvSummary.classList.remove('hidden');
    
    // Generate dynamic placeholders
    generatePlaceholderBadges(csvHeaders);

    // Populate Preview Controls
    currentPreviewIndex = 0;
    updatePreviewControlsDropdown();
    updateLivePreview();

    // Update queue totals
    updateSendingStats();

    alert(`Successfully imported ${recipientsData.length} recipients!`);
  }

  // Generate Clickable Placeholders
  function generatePlaceholderBadges(headers) {
    // Clear dynamic headers (but keep static if present, we just clear and remake all)
    placeholdersList.innerHTML = '';
    
    headers.forEach(h => {
      const badge = document.createElement('span');
      badge.className = h === 'Email' || h === 'Name' ? 'placeholder-tag static-tag' : 'placeholder-tag';
      badge.dataset.tag = h;
      badge.textContent = `{{${h}}}`;
      badge.addEventListener('click', () => insertPlaceholder(h));
      placeholdersList.appendChild(badge);
    });
  }

  // Insert tag into focused input
  function insertPlaceholder(tagName) {
    const el = activeInputField || emailBody;
    const tagText = `{{${tagName}}}`;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const originalValue = el.value;
    el.value = originalValue.substring(0, start) + tagText + originalValue.substring(end);
    el.selectionStart = el.selectionEnd = start + tagText.length;
    el.focus();
  }

  // --- Recipient Data Grid Modal ---
  btnViewRecipients.addEventListener('click', () => {
    if (recipientsData.length === 0) return;
    
    // Build Headers
    recipientsTableThead.innerHTML = '';
    const trHead = document.createElement('tr');
    csvHeaders.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trHead.appendChild(th);
    });
    recipientsTableThead.appendChild(trHead);

    // Build Rows
    recipientsTableTbody.innerHTML = '';
    recipientsData.forEach(row => {
      const trRow = document.createElement('tr');
      csvHeaders.forEach(h => {
        const td = document.createElement('td');
        td.textContent = row[h] || '';
        trRow.appendChild(td);
      });
      recipientsTableTbody.appendChild(trRow);
    });

    recipientsModalCount.textContent = `${recipientsData.length} recipients loaded`;
    openModal(recipientsModal);
  });

  const closeRecModal = () => closeModal(recipientsModal);
  btnCloseRecipients.addEventListener('click', closeRecModal);
  btnCloseRecipientsFooter.addEventListener('click', closeRecModal);

  // --- Live Preview Feature ---
  function updatePreviewControlsDropdown() {
    previewRecipientDropdown.innerHTML = '<option value="">-- Select Recipient --</option>';
    recipientsData.forEach((row, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `#${index + 1}: ${row.Email} ${row.Name ? `(${row.Name})` : ''}`;
      previewRecipientDropdown.appendChild(option);
    });
  }

  previewRecipientDropdown.addEventListener('change', (e) => {
    if (e.target.value !== '') {
      currentPreviewIndex = parseInt(e.target.value, 10);
      updateLivePreview();
    }
  });

  btnPrevRecipient.addEventListener('click', () => {
    if (recipientsData.length === 0) return;
    currentPreviewIndex = (currentPreviewIndex - 1 + recipientsData.length) % recipientsData.length;
    updateLivePreview();
  });

  btnNextRecipient.addEventListener('click', () => {
    if (recipientsData.length === 0) return;
    currentPreviewIndex = (currentPreviewIndex + 1) % recipientsData.length;
    updateLivePreview();
  });

  function renderTemplate(templateText, rowData) {
    if (!templateText) return '';
    let rendered = templateText;
    
    // Interpolate headers
    for (const key in rowData) {
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'gi');
      rendered = rendered.replace(regex, rowData[key] !== undefined ? rowData[key] : '');
    }
    
    // Replace remaining unmatched tags with empty string
    rendered = rendered.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, '');
    return rendered;
  }

  function updateLivePreview() {
    const total = recipientsData.length;
    if (total === 0) {
      previewCurrentIndex.textContent = '0';
      previewTotalCount.textContent = '0';
      previewFromHeader.textContent = 'Sender Name <smtp-user>';
      previewToHeader.textContent = 'recipient@domain.com';
      previewSubjectHeader.textContent = 'Email Subject';
      previewRenderedBody.innerHTML = '<div style="color: #64748b; font-style: italic;">No recipients loaded. Upload a CSV to view customized previews.</div>';
      
      const previewAttachmentRow = document.getElementById('preview-attachment-row');
      if (previewAttachmentRow) previewAttachmentRow.classList.add('hidden');
      return;
    }

    previewCurrentIndex.textContent = currentPreviewIndex + 1;
    previewTotalCount.textContent = total;
    previewRecipientDropdown.value = currentPreviewIndex;

    const row = recipientsData[currentPreviewIndex];
    // Headers
    const fromName = emailFromName.value.trim();
    previewFromHeader.textContent = fromName ? `${fromName} <configured-smtp-email>` : 'configured-smtp-email';
    previewToHeader.textContent = `${row.Email} ${row.Name ? `(${row.Name})` : ''}`;
    
    // Subject and Body interpolations
    const subRaw = emailSubject.value.trim() || 'No Subject';
    const bodyRaw = emailBody.value || '';
    
    const subjectRendered = renderTemplate(subRaw, row);
    const bodyRendered = renderTemplate(bodyRaw, row);

    previewSubjectHeader.textContent = subjectRendered;

    // Check if body contains HTML tags to render dynamically
    const hasHtml = /<[a-z][\s\S]*>/i.test(bodyRendered);
    if (hasHtml) {
      let previewHtml = bodyRendered;
      for (const cid in inlineImages) {
        const img = inlineImages[cid];
        const dataUri = `data:${img.contentType};base64,${img.content}`;
        previewHtml = previewHtml.replace(new RegExp(`cid:${cid}`, 'g'), dataUri);
      }
      previewRenderedBody.innerHTML = previewHtml;
    } else {
      previewRenderedBody.textContent = bodyRendered;
    }

    // Warn user about relative image paths (e.g. src="4.png") which break in email clients
    const relativeImgRegex = /<img[^>]+src=["'](?!https?:\/\/|cid:)([^"']+)["']/i;
    const hasRelativeImages = hasHtml && relativeImgRegex.test(bodyRendered);
    const warningBannerId = 'preview-relative-image-warning';
    let warningBanner = document.getElementById(warningBannerId);
    
    if (hasRelativeImages) {
      if (!warningBanner) {
        warningBanner = document.createElement('div');
        warningBanner.id = warningBannerId;
        warningBanner.style.background = 'rgba(245, 158, 11, 0.1)';
        warningBanner.style.border = '1px solid var(--color-warning)';
        warningBanner.style.color = 'var(--color-warning)';
        warningBanner.style.borderRadius = 'var(--radius-sm)';
        warningBanner.style.padding = '10px 14px';
        warningBanner.style.marginBottom = '15px';
        warningBanner.style.fontSize = '0.8rem';
        warningBanner.style.display = 'flex';
        warningBanner.style.alignItems = 'center';
        warningBanner.style.gap = '10px';
        warningBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><strong>Relative Image Path Detected:</strong> Images like "4.png" work in local preview but will appear broken in recipients' emails. Please upload them using <strong>3. Inline Images</strong> or use public HTTPS URLs.</span>`;
        previewRenderedBody.parentNode.insertBefore(warningBanner, previewRenderedBody);
      }
    } else {
      if (warningBanner) {
        warningBanner.remove();
      }
    }

    // Attachment Row Rendering in Preview
    const previewAttachmentRow = document.getElementById('preview-attachment-row');
    const previewAttachmentHeader = document.getElementById('preview-attachment-header');
    
    if (previewAttachmentRow && previewAttachmentHeader) {
      const headers = Object.keys(row);
      const attachmentCol = headers.find(h => 
        ['attachment', 'attachmentname', 'file', 'filename', 'document'].includes(h.toLowerCase())
      );

      // Determine personalized attachments
      const personalizedFilenames = new Set();
      if (attachmentCol) {
        recipientsData.forEach(r => {
          if (r[attachmentCol]) {
            const val = String(r[attachmentCol]).trim();
            if (!val.startsWith('http://') && !val.startsWith('https://')) {
              personalizedFilenames.add(val);
            }
          }
        });
      }

      // Collect global files (uploaded files that are not referenced in the CSV column)
      const globalFiles = [];
      for (const name in uploadedAttachments) {
        if (!personalizedFilenames.has(name)) {
          globalFiles.push(name);
        }
      }

      const hasPersonalized = !!(attachmentCol && row[attachmentCol]);
      const hasGlobal = globalFiles.length > 0;

      if (hasPersonalized || hasGlobal) {
        previewAttachmentRow.classList.remove('hidden');
        
        let previewHtmlParts = [];
        
        // Render global attachments
        if (hasGlobal) {
          const globalText = globalFiles.map(name => 
            `<span style="color: var(--color-success); font-weight: 500;"><i class="fa-solid fa-paperclip"></i> ${name} <small style="opacity:0.7">(Global)</small></span>`
          ).join(', ');
          previewHtmlParts.push(globalText);
        }

        // Render personalized attachment
        if (hasPersonalized) {
          const filename = String(row[attachmentCol]).trim();
          const isUrl = filename.startsWith('http://') || filename.startsWith('https://');
          
          if (isUrl) {
            const isMega = filename.toLowerCase().includes('mega.nz');
            const label = isMega ? 'MEGA Attachment' : 'URL Attachment';
            previewHtmlParts.push(`<span style="color: var(--accent-cyan); font-weight: 500;"><i class="fa-solid fa-cloud-arrow-down"></i> ${label} <small style="opacity:0.8">(Personalized)</small></span>`);
          } else {
            const fileExists = !!uploadedAttachments[filename];
            if (fileExists) {
              previewHtmlParts.push(`<span style="color: var(--color-success); font-weight: 500;"><i class="fa-solid fa-paperclip"></i> ${filename} <small style="opacity:0.8">(Personalized)</small></span>`);
            } else {
              previewHtmlParts.push(`<span style="color: var(--color-danger); font-weight: 500;"><i class="fa-solid fa-triangle-exclamation"></i> ${filename} <small style="opacity:0.8; color: var(--color-danger);">(Missing!)</small></span>`);
            }
          }
        }

        previewAttachmentHeader.innerHTML = previewHtmlParts.join(' | ');
      } else {
        previewAttachmentRow.classList.add('hidden');
      }
    }
  }

  // Listen to edits in Compose inputs to refresh preview in real-time
  emailSubject.addEventListener('input', () => {
    if (recipientsData.length > 0) updateLivePreview();
  });
  emailBody.addEventListener('input', () => {
    if (recipientsData.length > 0) updateLivePreview();
  });
  emailFromName.addEventListener('input', () => {
    if (recipientsData.length > 0) updateLivePreview();
  });

  // --- Bulk Sending Queue logic ---
  sendingDelaySlider.addEventListener('input', (e) => {
    currentDelay = parseFloat(e.target.value);
    delayValEl.textContent = `${currentDelay}s`;
  });

  function updateSendingStats() {
    const total = recipientsData.length;
    statTotal.textContent = total;
    
    if (!isSending) {
      statPending.textContent = total;
      statSuccess.textContent = '0';
      statFailed.textContent = '0';
      
      sendingStatusLabel.textContent = total > 0 ? 'Ready to send' : 'Please upload recipients';
      sendingPercentageLabel.textContent = '0%';
      sendingProgressBar.style.width = '0%';
    } else {
      statPending.textContent = pendingCount;
      statSuccess.textContent = successCount;
      statFailed.textContent = failedCount;
      
      const completed = successCount + failedCount;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      sendingPercentageLabel.textContent = `${pct}%`;
      sendingProgressBar.style.width = `${pct}%`;
    }
  }

  btnClearLogs.addEventListener('click', () => {
    queueLogsTbody.innerHTML = `
      <tr class="empty-log-row">
        <td colspan="5" class="text-center">No send jobs run yet. Start the bulk send to generate logs.</td>
      </tr>
    `;
  });

  function logSendStatus(index, email, subject, status, message) {
    // Remove empty log row if it exists
    const emptyRow = queueLogsTbody.querySelector('.empty-log-row');
    if (emptyRow) {
      emptyRow.remove();
    }

    const tr = document.createElement('tr');
    
    const tdIndex = document.createElement('td');
    tdIndex.textContent = `#${index + 1}`;
    
    const tdEmail = document.createElement('td');
    tdEmail.textContent = email;
    tdEmail.className = 'font-medium';
    
    const tdSubject = document.createElement('td');
    tdSubject.textContent = subject;
    
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge badge-${status}`;
    
    let icon = '';
    if (status === 'success') icon = '<i class="fa-solid fa-circle-check"></i> ';
    if (status === 'failed') icon = '<i class="fa-solid fa-circle-exclamation"></i> ';
    if (status === 'sending') icon = '<i class="fa-solid fa-spinner fa-spin"></i> ';
    badge.innerHTML = icon + status.toUpperCase();
    tdStatus.appendChild(badge);
    
    const tdMessage = document.createElement('td');
    tdMessage.textContent = message;
    if (status === 'failed') {
      tdMessage.style.color = 'var(--color-danger)';
    } else if (status === 'success') {
      tdMessage.style.color = 'var(--color-success)';
    }

    tr.appendChild(tdIndex);
    tr.appendChild(tdEmail);
    tr.appendChild(tdSubject);
    tr.appendChild(tdStatus);
    tr.appendChild(tdMessage);

    queueLogsTbody.appendChild(tr);

    // Scroll to the bottom of the log table
    const container = queueLogsTbody.closest('.logs-table-container');
    container.scrollTop = container.scrollHeight;

    return tr; // Return to update later if needed
  }

  // Send Bulk Email Process Starter
  btnStartSending.addEventListener('click', async () => {
    if (recipientsData.length === 0) {
      alert('Please upload a CSV file with your recipient list first.');
      switchTab('tab-compose');
      return;
    }

    const subjectText = emailSubject.value.trim();
    const bodyText = emailBody.value.trim();
    if (!subjectText || !bodyText) {
      alert('Please fill out both the Subject and Body email templates.');
      switchTab('tab-compose');
      return;
    }

    // Toggle states
    if (isSending && isPaused) {
      // Resume
      isPaused = false;
      btnPauseSending.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      sendingStatusLabel.textContent = 'Sending emails...';
      processNextQueueItem();
      return;
    }

    // Start fresh queue
    const confirmSend = confirm(`Are you sure you want to start sending ${recipientsData.length} personalized emails?`);
    if (!confirmSend) return;

    isSending = true;
    isPaused = false;
    currentQueueIndex = 0;
    successCount = 0;
    failedCount = 0;
    pendingCount = recipientsData.length;

    // Clear logs
    queueLogsTbody.innerHTML = '';
    
    // Toggle controls
    toggleComposerInputs(true);
    btnStartSending.disabled = true;
    btnPauseSending.disabled = false;
    btnStopSending.disabled = false;

    sendingStatusLabel.textContent = 'Sending emails...';
    updateSendingStats();

    // Start sending loop
    processNextQueueItem();
  });

  // Toggle editor locks
  function toggleComposerInputs(disabled) {
    emailFromName.disabled = disabled;
    emailSubject.disabled = disabled;
    emailBody.disabled = disabled;
    csvFileInput.disabled = disabled;
    if (disabled) {
      csvDropzone.style.pointerEvents = 'none';
      csvDropzone.style.opacity = 0.5;
    } else {
      csvDropzone.style.pointerEvents = 'auto';
      csvDropzone.style.opacity = 1;
    }
  }

  btnPauseSending.addEventListener('click', () => {
    if (!isSending) return;

    if (isPaused) {
      // Resume
      isPaused = false;
      btnPauseSending.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      sendingStatusLabel.textContent = 'Sending emails...';
      processNextQueueItem();
    } else {
      // Pause
      isPaused = true;
      btnPauseSending.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
      sendingStatusLabel.textContent = 'Sending paused';
      clearTimeout(sendingTimer);
    }
  });

  btnStopSending.addEventListener('click', () => {
    const confirmStop = confirm('Are you sure you want to cancel the bulk send? Remaining emails will not be sent.');
    if (!confirmStop) return;

    stopQueueRunner('Sending stopped by user.');
  });

  function stopQueueRunner(statusMessage) {
    clearTimeout(sendingTimer);
    isSending = false;
    isPaused = false;
    
    btnStartSending.disabled = false;
    btnStartSending.innerHTML = '<i class="fa-solid fa-play"></i> Start Bulk Send';
    btnPauseSending.disabled = true;
    btnPauseSending.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    btnStopSending.disabled = true;
    
    toggleComposerInputs(false);
    sendingStatusLabel.textContent = statusMessage;
    
    updateSendingStats();
  }

  function getFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  }

  async function processNextQueueItem() {
    if (!isSending || isPaused) return;

    if (currentQueueIndex >= recipientsData.length) {
      // Finished!
      stopQueueRunner('Completed sending queue!');
      triggerSuccessCelebration();
      return;
    }

    const row = recipientsData[currentQueueIndex];
    const fromName = emailFromName.value.trim();
    
    // Interpolate template for current recipient
    const subjectRendered = renderTemplate(emailSubject.value.trim(), row);
    const bodyRendered = renderTemplate(emailBody.value, row);

    // Add immediate temporary log showing sending state
    const logRow = logSendStatus(currentQueueIndex, row.Email, subjectRendered, 'sending', 'Connecting to SMTP server...');
    
    pendingCount--;
    updateSendingStats();

    // Check for matching attachment columns
    const headers = Object.keys(row);
    const attachmentCol = headers.find(h => 
      ['attachment', 'attachmentname', 'file', 'filename', 'document'].includes(h.toLowerCase())
    );

    // Determine personalized attachments
    const personalizedFilenames = new Set();
    if (attachmentCol) {
      recipientsData.forEach(r => {
        if (r[attachmentCol]) {
          const val = String(r[attachmentCol]).trim();
          if (!val.startsWith('http://') && !val.startsWith('https://')) {
            personalizedFilenames.add(val);
          }
        }
      });
    }

    let attachmentsPayload = [];

    // 1. Add global attachments (uploaded files that are not personalized)
    for (const filename in uploadedAttachments) {
      if (!personalizedFilenames.has(filename)) {
        const file = uploadedAttachments[filename];
        try {
          const base64Content = await getFileBase64(file);
          attachmentsPayload.push({
            filename: file.name,
            content: base64Content,
            contentType: file.type
          });
        } catch (err) {
          failedCount++;
          if (logRow) logRow.remove();
          logSendStatus(currentQueueIndex, row.Email, subjectRendered, 'failed', `Global attachment '${filename}' read error: ${err.message}`);
          currentQueueIndex++;
          updateSendingStats();
          if (isSending && !isPaused) {
            sendingTimer = setTimeout(processNextQueueItem, currentDelay * 1000);
          }
          return;
        }
      }
    }

    // 2. Add personalized attachment (if present)
    if (attachmentCol && row[attachmentCol]) {
      const filename = String(row[attachmentCol]).trim();
      const isUrl = filename.startsWith('http://') || filename.startsWith('https://');

      if (isUrl) {
        attachmentsPayload.push({
          filename: 'URL_Attachment',
          url: filename
        });
      } else {
        const file = uploadedAttachments[filename];
        if (file) {
          try {
            const base64Content = await getFileBase64(file);
            attachmentsPayload.push({
              filename: file.name,
              content: base64Content,
              contentType: file.type
            });
          } catch (err) {
            failedCount++;
            if (logRow) logRow.remove(); // Remove the "sending" status log
            logSendStatus(currentQueueIndex, row.Email, subjectRendered, 'failed', `Attachment read error: ${err.message}`);
            currentQueueIndex++;
            updateSendingStats();
            if (isSending && !isPaused) {
              sendingTimer = setTimeout(processNextQueueItem, currentDelay * 1000);
            }
            return;
          }
        } else {
          // Filename specified in CSV, but file is not uploaded in the browser!
          failedCount++;
          if (logRow) logRow.remove(); // Remove the "sending" status log
          logSendStatus(currentQueueIndex, row.Email, subjectRendered, 'failed', `Missing attachment: file '${filename}' not uploaded in browser.`);
          currentQueueIndex++;
          updateSendingStats();
          if (isSending && !isPaused) {
            sendingTimer = setTimeout(processNextQueueItem, currentDelay * 1000);
          }
          return;
        }
      }
    }

    // Append inline images if referenced in the email template body
    const cidRegex = /cid:([a-zA-Z0-9_-]+)/g;
    const matches = [...bodyRendered.matchAll(cidRegex)];
    const usedCids = new Set(matches.map(m => m[1]));

    usedCids.forEach(cid => {
      if (inlineImages[cid]) {
        attachmentsPayload.push({
          filename: inlineImages[cid].filename,
          content: inlineImages[cid].content,
          contentType: inlineImages[cid].contentType,
          cid: cid
        });
      }
    });

    // Prepare payload
    const emailPayload = {
      email: {
        from: fromName || undefined,
        to: row.Email,
        subject: subjectRendered,
        html: /<[a-z][\s\S]*>/i.test(bodyRendered) ? bodyRendered : undefined,
        text: /<[a-z][\s\S]*>/i.test(bodyRendered) ? undefined : bodyRendered,
        attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined
      }
    };

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });
      const data = await response.json();

      if (response.ok && data.success) {
        successCount++;
        updateLogRow(logRow, 'success', 'Successfully sent!');
      } else {
        failedCount++;
        updateLogRow(logRow, 'failed', data.error || 'Server error occurred.');
      }
    } catch (err) {
      console.error(err);
      failedCount++;
      updateLogRow(logRow, 'failed', 'Network request failed. Is the server running?');
    }

    currentQueueIndex++;
    updateSendingStats();

    // Schedule next send
    if (isSending && !isPaused) {
      sendingTimer = setTimeout(processNextQueueItem, currentDelay * 1000);
    }
  }

  function updateLogRow(rowElement, status, message) {
    const badge = rowElement.querySelector('.badge');
    badge.className = `badge badge-${status}`;
    
    let icon = '';
    if (status === 'success') icon = '<i class="fa-solid fa-circle-check"></i> ';
    if (status === 'failed') icon = '<i class="fa-solid fa-circle-exclamation"></i> ';
    badge.innerHTML = icon + status.toUpperCase();
    
    const messageCell = rowElement.cells[4];
    messageCell.textContent = message;
    if (status === 'failed') {
      messageCell.style.color = 'var(--color-danger)';
    } else if (status === 'success') {
      messageCell.style.color = 'var(--color-success)';
    }
  }

  function triggerSuccessCelebration() {
    if (successCount > 0) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#06b6d4', '#10b981']
      });
    }
  }

  // --- Sample CSV/Excel file setup ---
  function setupSampleCSVDownload() {
    // CSV Download
    downloadSampleCsvLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      const csvContent = 
`Email,Name,Company,PromoCode
john.doe@example.com,John Doe,Stark Industries,STARK50
jane.smith@example.com,Jane Smith,Wayne Enterprises,WAYNE20
bruce.wayne@example.com,Bruce Wayne,Bat Cave,HERO100`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "mergemail_sample_recipients.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // Excel Download
    const downloadSampleXlsxLink = document.getElementById('download-sample-xlsx');
    if (downloadSampleXlsxLink) {
      downloadSampleXlsxLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        const data = [
          { Email: "john.doe@example.com", Name: "John Doe", Company: "Stark Industries", PromoCode: "STARK50" },
          { Email: "jane.smith@example.com", Name: "Jane Smith", Company: "Wayne Enterprises", PromoCode: "WAYNE20" },
          { Email: "bruce.wayne@example.com", Name: "Bruce Wayne", Company: "Bat Cave", PromoCode: "HERO100" }
        ];

        // Create workbook using XLSX
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");
        
        // Write file and trigger download
        XLSX.writeFile(workbook, "mergemail_sample_recipients.xlsx");
      });
    }
  }

});

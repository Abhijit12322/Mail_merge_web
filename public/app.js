// MergeMail Frontend Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let recipientsData = []; // Array of objects containing recipient details
  let csvHeaders = [];     // List of headers detected in the CSV
  let currentPreviewIndex = 0;
  let activeInputField = null; // Tracks if subject or body was focused last
  
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
  // Header
  const smtpStatusIndicator = document.getElementById('smtp-status');
  const btnOpenSmtp = document.getElementById('btn-open-smtp');
  
  // Sidebar (Recipients & Placeholders)
  const csvDropzone = document.getElementById('csv-dropzone');
  const csvFileInput = document.getElementById('csv-file-input');
  const csvSummary = document.getElementById('csv-summary');
  const recipientCountEl = document.getElementById('recipient-count');
  const columnsCountEl = document.getElementById('columns-count');
  const btnViewRecipients = document.getElementById('btn-view-recipients');
  const downloadSampleCsvLink = document.getElementById('download-sample-csv');
  const placeholdersList = document.getElementById('placeholders-list');

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

  // Modals
  const smtpModal = document.getElementById('smtp-modal');
  const smtpForm = document.getElementById('smtp-form');
  const btnCloseSmtp = document.getElementById('btn-close-smtp');
  const btnTestSmtp = document.getElementById('btn-test-smtp');
  const btnTogglePassword = document.getElementById('btn-toggle-password');
  
  const smtpHostInput = document.getElementById('smtp-host');
  const smtpPortInput = document.getElementById('smtp-port');
  const smtpSecureCheckbox = document.getElementById('smtp-secure');
  const smtpUserInput = document.getElementById('smtp-user');
  const smtpPassInput = document.getElementById('smtp-pass');

  const recipientsModal = document.getElementById('recipients-modal');
  const btnCloseRecipients = document.getElementById('btn-close-recipients');
  const btnCloseRecipientsFooter = document.getElementById('btn-close-recipients-footer');
  const recipientsTableThead = document.getElementById('recipients-table-thead');
  const recipientsTableTbody = document.getElementById('recipients-table-tbody');
  const recipientsModalCount = document.getElementById('recipients-modal-count');

  // --- Initial Setup & Load Cache ---
  loadSmtpSettings();
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

  btnOpenSmtp.addEventListener('click', () => openModal(smtpModal));
  btnCloseSmtp.addEventListener('click', () => closeModal(smtpModal));
  
  // Close modals on clicking outside card
  window.addEventListener('click', (e) => {
    if (e.target === smtpModal) closeModal(smtpModal);
    if (e.target === recipientsModal) closeModal(recipientsModal);
  });

  // Toggle Password Visibility
  btnTogglePassword.addEventListener('click', () => {
    const type = smtpPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
    smtpPassInput.setAttribute('type', type);
    const icon = btnTogglePassword.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });

  // --- SMTP Configurations Settings ---
  function getSmtpSettings() {
    return {
      host: smtpHostInput.value.trim(),
      port: smtpPortInput.value.trim(),
      secure: smtpSecureCheckbox.checked,
      user: smtpUserInput.value.trim(),
      pass: smtpPassInput.value.trim()
    };
  }

  function saveSmtpSettings(settings) {
    localStorage.setItem('merge_mail_smtp_settings', JSON.stringify(settings));
    updateSmtpStatusIndicator(true);
  }

  function loadSmtpSettings() {
    const cached = localStorage.getItem('merge_mail_smtp_settings');
    if (cached) {
      try {
        const settings = JSON.parse(cached);
        smtpHostInput.value = settings.host || '';
        smtpPortInput.value = settings.port || '';
        smtpSecureCheckbox.checked = settings.secure !== false;
        smtpUserInput.value = settings.user || '';
        smtpPassInput.value = settings.pass || '';
        updateSmtpStatusIndicator(true);
      } catch (e) {
        console.error('Failed to parse cached SMTP settings', e);
        updateSmtpStatusIndicator(false);
      }
    } else {
      updateSmtpStatusIndicator(false);
    }
  }

  function updateSmtpStatusIndicator(isConfigured) {
    if (isConfigured) {
      smtpStatusIndicator.className = "smtp-status-indicator configured";
      smtpStatusIndicator.querySelector('.status-text').textContent = "SMTP Configured";
    } else {
      smtpStatusIndicator.className = "smtp-status-indicator unconfigured";
      smtpStatusIndicator.querySelector('.status-text').textContent = "SMTP Not Configured";
    }
  }

  // SMTP Settings Submission
  smtpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = getSmtpSettings();
    saveSmtpSettings(settings);
    closeModal(smtpModal);
    alert('SMTP Settings Saved Successfully!');
  });

  // Test SMTP Settings
  btnTestSmtp.addEventListener('click', async () => {
    const settings = getSmtpSettings();
    if (!settings.host || !settings.port || !settings.user || !settings.pass) {
      alert('Please fill out all SMTP fields to test the connection.');
      return;
    }

    btnTestSmtp.disabled = true;
    btnTestSmtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing Connection...';

    // Test email options (sending a test email to oneself)
    const testPayload = {
      smtpConfig: settings,
      email: {
        from: settings.user,
        to: settings.user,
        subject: 'MergeMail Connection Test',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 500px;">
            <h2 style="color: #6366f1; margin-top: 0;">Connection Successful!</h2>
            <p>Your SMTP configurations on MergeMail are correct and active.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <small style="color: #64748b;">Sent via local email merge helper.</small>
          </div>
        `
      }
    };

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      const data = await response.json();

      if (response.ok && data.success) {
        saveSmtpSettings(settings);
        alert('Success! A test email has been successfully sent to: ' + settings.user);
      } else {
        alert('Connection Failed: ' + (data.error || 'Check details and try again.'));
      }
    } catch (err) {
      console.error(err);
      alert('Error testing SMTP connection: Could not reach backend server.');
    } finally {
      btnTestSmtp.disabled = false;
      btnTestSmtp.innerHTML = '<i class="fa-solid fa-vial"></i> Test & Save Connection';
    }
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
      return;
    }

    previewCurrentIndex.textContent = currentPreviewIndex + 1;
    previewTotalCount.textContent = total;
    previewRecipientDropdown.value = currentPreviewIndex;

    const row = recipientsData[currentPreviewIndex];
    const smtpSettings = getSmtpSettings();
    
    // Headers
    const fromName = emailFromName.value.trim();
    const fromUser = smtpSettings.user || 'sender@example.com';
    previewFromHeader.textContent = fromName ? `${fromName} <${fromUser}>` : fromUser;
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
      previewRenderedBody.innerHTML = bodyRendered;
    } else {
      previewRenderedBody.textContent = bodyRendered;
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
    // Validation
    const smtpSettings = getSmtpSettings();
    if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass) {
      alert('Please configure your SMTP Settings before sending emails.');
      openModal(smtpModal);
      return;
    }

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

  async function processNextQueueItem() {
    if (!isSending || isPaused) return;

    if (currentQueueIndex >= recipientsData.length) {
      // Finished!
      stopQueueRunner('Completed sending queue!');
      triggerSuccessCelebration();
      return;
    }

    const row = recipientsData[currentQueueIndex];
    const smtpSettings = getSmtpSettings();
    const fromName = emailFromName.value.trim();
    
    // Interpolate template for current recipient
    const subjectRendered = renderTemplate(emailSubject.value.trim(), row);
    const bodyRendered = renderTemplate(emailBody.value, row);

    // Add immediate temporary log showing sending state
    const logRow = logSendStatus(currentQueueIndex, row.Email, subjectRendered, 'sending', 'Connecting to SMTP server...');
    
    pendingCount--;
    updateSendingStats();

    // Prepare payload
    const emailPayload = {
      smtpConfig: smtpSettings,
      email: {
        from: fromName ? `${fromName} <${smtpSettings.user}>` : smtpSettings.user,
        to: row.Email,
        subject: subjectRendered,
        html: /<[a-z][\s\S]*>/i.test(bodyRendered) ? bodyRendered : undefined,
        text: /<[a-z][\s\S]*>/i.test(bodyRendered) ? undefined : bodyRendered
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

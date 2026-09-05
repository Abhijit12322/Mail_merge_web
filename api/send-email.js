const nodemailer = require('nodemailer');
const { File } = require('megajs');

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email details.' });
  }

  // Load SMTP configurations internally from environment variables
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const { from, to, subject, html, text, attachments } = email;

  if (!host || !port || !user || !pass) {
    return res.status(500).json({ error: 'Server configuration error: Incomplete internal SMTP setup on server.' });
  }

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Incomplete email details. Recipient (to), subject, and content are required.' });
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: secure === true || secure === 'true', // true for port 465, false for other ports
      auth: {
        user,
        pass,
      },
      // Timeout configurations to prevent hanging serverless functions
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    // Resolve attachments (base64, remote URLs, MEGA links)
    let resolvedAttachments = undefined;
    if (attachments && attachments.length > 0) {
      resolvedAttachments = [];
      for (const att of attachments) {
        if (att.url) {
          const isMega = att.url.toLowerCase().includes('mega.nz');
          if (isMega) {
            try {
              const file = File.fromURL(att.url);
              await file.loadAttributes();
              const buffer = await file.downloadBuffer();
              resolvedAttachments.push({
                filename: file.name || att.filename || 'MEGA_Attachment',
                content: buffer
              });
            } catch (megaErr) {
              console.error('MEGA attachment download error:', megaErr);
              return res.status(400).json({
                success: false,
                error: `Failed to download MEGA attachment (${att.url}): ${megaErr.message}`
              });
            }
          } else {
            // Regular URL
            resolvedAttachments.push({
              filename: att.filename !== 'URL_Attachment' ? att.filename : undefined,
              path: att.url
            });
          }
        } else if (att.content) {
          // Base64 upload
          const resolvedAtt = {
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
            contentType: att.contentType
          };
          if (att.cid) {
            resolvedAtt.cid = att.cid;
          }
          resolvedAttachments.push(resolvedAtt);
        }
      }
    }

    const finalFrom = (from && from.includes('@')) ? from : (from ? `${from} <${user}>` : user);

    // Send mail
    const mailOptions = {
      from: finalFrom,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      attachments: resolvedAttachments
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while sending the email.',
    });
  }
};

const nodemailer = require('nodemailer');

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

  const { smtpConfig, email } = req.body;

  if (!smtpConfig || !email) {
    return res.status(400).json({ error: 'Missing SMTP configuration or email details.' });
  }

  const { host, port, secure, user, pass } = smtpConfig;
  const { from, to, subject, html, text, attachments } = email;

  if (!host || !port || !user || !pass) {
    return res.status(400).json({ error: 'Incomplete SMTP configuration. Host, port, user, and password are required.' });
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

    // Send mail
    const mailOptions = {
      from: from || user,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      attachments: attachments ? attachments.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType
      })) : undefined
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

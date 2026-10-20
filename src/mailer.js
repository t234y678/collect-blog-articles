import nodemailer from 'nodemailer';

export class Mailer {
  constructor(config) {
    // Resend(SMTP)を優先し、未設定ならGmailにフォールバック
    this.transporter = config.resendApiKey
      ? nodemailer.createTransport({
          host: 'smtp.resend.com',
          port: 465,
          secure: true,
          auth: {
            user: 'resend',
            pass: config.resendApiKey
          }
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.user,
            pass: config.appPassword
          }
        });
    this.from = config.from || config.user;
    this.to = config.to;
  }

  async sendNewsletter(subject, htmlContent, textContent) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject: subject,
      html: htmlContent,
      text: textContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Newsletter sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Failed to send newsletter:', error.message);
      throw error;
    }
  }

  async verify() {
    try {
      await this.transporter.verify();
      console.log('Mail server connection verified');
      return true;
    } catch (error) {
      console.error('Mail server verification failed:', error.message);
      return false;
    }
  }
}

export default Mailer;

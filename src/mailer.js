import nodemailer from 'nodemailer';

export class Mailer {
  constructor(config) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.appPassword
      }
    });
    this.from = config.user;
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

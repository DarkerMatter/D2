// utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendVerificationEmail(email, token) {
    const verificationUrl = `https://${process.env.DOMAIN_NAME}/verify-email?token=${token}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Verify Your Email Address for D2 Rage Counter',
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h2>Welcome to D2 Rage Counter!</h2>
                <p>Please click the button below to verify your email address and activate your account.</p>
                <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
                    Verify Email
                </a>
                <p style="margin-top: 30px; font-size: 12px; color: #888;">If you did not sign up for this account, you can safely ignore this email.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${email}`);
    } catch (error) {
        console.error(`Error sending verification email to ${email}:`, error);
        // In a real app, you might want to handle this more gracefully
        throw new Error('Failed to send verification email.');
    }
}

module.exports = { sendVerificationEmail };
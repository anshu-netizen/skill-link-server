import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

const sendEmail = async ({ to, subject, html }: SendEmailParams) => {
  await transporter.sendMail({
    from: `"SkillLink" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

export default sendEmail;
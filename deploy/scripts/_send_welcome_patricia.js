const postmark = require("postmark");
const c = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN);

const pw = "AmC4BoLfF8#uVp";
const to = process.argv[2] || "patricia.lumba@au-aris.org";
const name = process.argv[3] || "Patricia Lumba";

const html = `<html><body style="margin:0;padding:20px;background:#f1f5f9;font-family:sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<div style="background:linear-gradient(90deg,#003366,#0b4d8f);padding:24px 28px">
<h1 style="margin:0;font-size:22px;color:#fff">Welcome to ARIS</h1>
<p style="margin:4px 0 0;font-size:13px;color:#93c5fd">Animal Resources Information System &mdash; AU-IBAR</p>
</div>
<div style="padding:28px">
<p style="font-size:15px;color:#475569;line-height:22px">Dear Patricia Lumba,<br>Your account has been created on the ARIS platform. Below are your login credentials.</p>
<div style="border:1px solid #dce3ec;border-radius:10px;overflow:hidden;margin:20px 0">
<div style="background:#003366;padding:12px 18px">
<div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#D4AF37">YOUR CREDENTIALS</div>
<div style="font-size:13px;color:#fff;margin-top:2px">Keep this information secure</div>
</div>
<div style="padding:14px 18px;background:#f7f9fc">
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:8px 0;font-size:12px;color:#64748b;width:140px">Email</td><td style="font-size:14px;font-family:monospace;font-weight:500;color:#0f172a">patricia.lumba@au-aris.org</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#64748b">Temporary Password</td><td style="padding:8px 0"><code style="font-size:14px;font-weight:700;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;font-family:monospace;color:#0f172a">${pw}</code></td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#64748b">Role</td><td style="font-size:14px;font-weight:500;color:#0f172a">Field Agent</td></tr>
<tr><td style="padding:8px 0;font-size:12px;color:#64748b">Organization</td><td style="font-size:14px;font-weight:500;color:#0f172a">AU-IBAR (Continental)</td></tr>
</table>
</div></div>
<div style="background:#fff7e8;border:1px solid #f7d58d;border-left:4px solid #D4AF37;border-radius:8px;padding:12px 16px;margin:0 0 22px">
<div style="font-size:13px;font-weight:700;color:#7a5c00;margin-bottom:4px">Important: Change Your Password</div>
<div style="font-size:13px;color:#6b4b00;line-height:19px">For security, you will be asked to change your password upon first login. Choose a strong password with at least 8 characters.</div>
</div>
<table><tr><td style="border-radius:8px;background:linear-gradient(90deg,#003366,#0b4d8f)">
<a href="https://au-aris.org/login" target="_blank" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">Sign In to ARIS</a>
</td></tr></table>
<div style="margin-top:20px;font-size:14px;font-weight:700;color:#003366">Getting Started</div>
<p style="font-size:13px;color:#334155;line-height:20px;margin:8px 0">
<b>1.</b> Go to <a href="https://au-aris.org/login" style="color:#0b4d8f">https://au-aris.org/login</a><br>
<b>2.</b> Enter your email and temporary password<br>
<b>3.</b> Change your password when prompted<br>
<b>4.</b> Explore your dashboard and start working
</p>
<p style="margin:20px 0 0;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px">This email contains sensitive credentials. If you did not request this account, please contact your AU-IBAR administrator immediately.</p>
</div></div></body></html>`;

c.sendEmail({
  From: process.env.POSTMARK_FROM || "noreply@au-aris.org",
  To: "patricia.lumba@au-aris.org",
  Subject: "ARIS — Your Account Credentials / Vos identifiants",
  HtmlBody: html,
  MessageStream: "outbound",
  Tag: "welcome"
}).then(r => console.log("OK MessageID=" + r.MessageID))
  .catch(e => console.error("FAIL", e.message));

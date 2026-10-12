const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export const buildEmailHtml = ({ subject, text, html }) => `<!doctype html>
<html lang="it"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f6f9;font-family:Arial,sans-serif;color:#243247">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-collapse:collapse">
    <tr><td style="padding:24px;border-bottom:1px solid #e4e9ef"><img src="cid:hlc-scheduler-logo" alt="HLC Scheduler" width="240" style="display:block;width:240px;max-width:100%;height:auto;border:0"></td></tr>
    <tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 20px">${escapeHtml(subject)}</h1>
      ${html ?? `<p style="font-size:15px;line-height:1.6;margin:0">${escapeHtml(text).replace(/\r\n|\r|\n/g, "<br>")}</p>`}
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #e4e9ef;font-size:12px;color:#667085">HLC Scheduler · Notifica automatica</td></tr>
  </table>
</body></html>`;

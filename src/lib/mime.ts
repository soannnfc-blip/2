export function buildMimeWithAttachment({
  to,
  subject,
  body,
  attachment,
}: {
  to: string;
  subject: string;
  body: string;
  attachment: { filename: string; mimeType: string; content: Buffer };
}) {
  const boundary = `noteo_${Date.now()}`;
  const parts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
    "",
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    "",
    attachment.content.toString("base64"),
    "",
    `--${boundary}--`,
  ];
  return Buffer.from(parts.join("\n")).toString("base64url");
}

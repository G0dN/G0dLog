import tls from "node:tls";

const subject = process.argv[2] || "G0dLog operational alert";
const message = process.argv.slice(3).join(" ") || "G0dLog reported an operational failure.";
const host = process.env.SMTP_HOST?.trim();
const port = Number(process.env.SMTP_PORT || 465);
const username = process.env.SMTP_USER?.trim();
const password = process.env.SMTP_PASSWORD;
const recipient = process.env.ALERT_EMAIL?.trim();

if (!host || !username || !password || !recipient) {
  console.log("SMTP alert is not configured; leaving the alert in the deployment log.");
  process.exit(0);
}
if (port !== 465) throw new Error("send-alert.mjs currently supports implicit TLS SMTP on port 465");

function waitForResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const match = lines[index].match(/^(\d{3})([ -])/);
        if (!match || match[2] !== " ") continue;
        socket.off("data", onData);
        const code = Number(match[1]);
        if (code >= 400) reject(new Error(`SMTP command failed with ${code}`));
        else resolve(code);
        return;
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
    socket.once("close", () => reject(new Error("SMTP connection closed unexpectedly")));
  });
}

const socket = tls.connect({ host, port, servername: host });
try {
  await waitForResponse(socket);
  const command = async (value) => { socket.write(value + "\r\n"); await waitForResponse(socket); };
  await command(`EHLO g0dlog`);
  await command("AUTH LOGIN");
  await command(Buffer.from(username).toString("base64"));
  await command(Buffer.from(password).toString("base64"));
  await command(`MAIL FROM:<${username}>`);
  await command(`RCPT TO:<${recipient}>`);
  await command("DATA");
  const safeSubject = subject.replace(/[\r\n]/g, " ");
  const safeMessage = message.replace(/\r?\n/g, "\n").replace(/^\./gm, "..");
  socket.write(`From: ${username}\r\nTo: ${recipient}\r\nSubject: ${safeSubject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${safeMessage}\r\n.\r\n`);
  await waitForResponse(socket);
  await command("QUIT");
  console.log("Operational alert sent.");
} finally {
  socket.end();
}

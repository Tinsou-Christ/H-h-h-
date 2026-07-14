/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 *
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * Vietnamese:
 * ! Vui lòng không thay đổi mã bên dưới, nó rất quan trọng đối với dự án.
 * Nó là động lực để tôi duy trì và phát triển dự án miễn phí.
 * ! Nếu thay đổi nó, bạn sẽ bị cấm vĩnh viễn
 * Cảm ơn bạn đã sử dụng
 */

const { spawn } = require("child_process");
const http = require("http");
const log = require("./logger/log.js");

// Bind an HTTP port so hosts like Render/Heroku detect the service as live.
// The internal dashboard may also bind its own port; this one is only used
// when process.env.PORT is set (typical on Render).
const PORT = process.env.PORT;
if (PORT) {
	http.createServer((req, res) => {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("Bot is running");
	}).listen(PORT, "0.0.0.0", () => {
		console.log(`[KEEP-ALIVE] HTTP server listening on 0.0.0.0:${PORT}`);
	}).on("error", (err) => {
		console.error("[KEEP-ALIVE] Failed to bind port:", err.message);
	});
}

function startProject() {
	const child = spawn("node", ["Goat.js"], {
		cwd: __dirname,
		stdio: "inherit",
		shell: true
	});

	child.on("close", (code) => {
		if (code == 2) {
			log.info("Restarting Project...");
			startProject();
		}
	});
}

startProject();

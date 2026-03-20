const { spawn } = require("child_process");

const processes = [
  {
    name: "backend",
    color: "\u001b[34m",
    command: "npm run dev:backend"
  },
  {
    name: "frontend",
    color: "\u001b[32m",
    command: "npm run dev:frontend"
  }
];

const reset = "\u001b[0m";
const children = [];

function prefixOutput(name, color, data, target) {
  const lines = data.toString().split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    target.write(`${color}[${name}]${reset} ${line}\n`);
  }
}

for (const proc of processes) {
  const child = spawn(proc.command, [], {
    cwd: process.cwd(),
    stdio: ["inherit", "pipe", "pipe"],
    shell: true
  });

  child.stdout.on("data", (data) => prefixOutput(proc.name, proc.color, data, process.stdout));
  child.stderr.on("data", (data) => prefixOutput(proc.name, proc.color, data, process.stderr));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  children.push(child);
}

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit();
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit();
});

require('dotenv').config();
const { execSync } = require('child_process');

const PORT = Number(process.env.PORT) || 8005;

function getPidsWindows(port) {
  const output = execSync('netstat -ano -p TCP', { encoding: 'utf8' });
  const pids = new Set();

  output.split('\n').forEach((line) => {
    if (!/LISTENING|ESCUCHA/i.test(line)) return;
    if (!line.includes(`:${port}`)) return;

    const pid = line.trim().split(/\s+/).pop();
    if (pid && pid !== '0') pids.add(pid);
  });

  return [...pids];
}

function stopWindows(port) {
  const pids = getPidsWindows(port);

  if (pids.length === 0) {
    console.log(`No hay proceso usando el puerto ${port}`);
    return;
  }

  pids.forEach((pid) => {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    console.log(`Proceso ${pid} detenido`);
  });

  console.log(`Puerto ${port} liberado`);
}

function stopUnix(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: 'ignore', shell: true });
    console.log(`Puerto ${port} liberado`);
  } catch {
    console.log(`No hay proceso usando el puerto ${port}`);
  }
}

try {
  if (process.platform === 'win32') {
    stopWindows(PORT);
  } else {
    stopUnix(PORT);
  }
} catch (error) {
  console.error(`Error al detener el servidor: ${error.message}`);
  process.exit(1);
}

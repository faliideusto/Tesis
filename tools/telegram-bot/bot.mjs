import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { receive, remember, Store, validateConfig, Worker } from './core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = join(root, '.telegram-bot');
const identifyOnly = process.argv.includes('--identify');
const config = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));
validateConfig(identifyOnly ? { ...config, allowedUserIds: [1] } : config);
const token = process.env.TESIS_TELEGRAM_TOKEN;
if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Falta el token local de Telegram. Ejecuta setup.ps1 y start.ps1.');
// El secreto queda únicamente en el transporte de Telegram; no heredar a comandos.
delete process.env.TESIS_TELEGRAM_TOKEN;
mkdirSync(dataDir, { recursive: true });
const lockFile = join(dataDir, 'bot.lock');
if (existsSync(lockFile)) {
  const pid = Number(readFileSync(lockFile, 'utf8'));
  let alive = true;
  try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
  if (alive) throw new Error('Ya hay un bot activo. No abras dos ventanas.');
  unlinkSync(lockFile);
}
const lock = openSync(lockFile, 'wx');
writeFileSync(lock, String(process.pid));
closeSync(lock);
process.on('exit', () => { try { unlinkSync(lockFile); } catch {} });

let stopping = false, processing = false;
process.on('SIGINT', () => { stopping = true; console.log('Cerrando después de la tarea actual. No cierres la ventana hasta que termine.'); });
process.on('SIGTERM', () => { stopping = true; });

async function telegram(method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const error = new Error(`Telegram rechazó ${method} (${result.error_code ?? response.status}).`);
      error.fatal = [401, 409].includes(result.error_code ?? response.status);
      error.discard = method === 'sendMessage' && [400, 403].includes(result.error_code ?? response.status);
      throw error;
    }
    return result.result;
  } catch (error) {
    // Los errores fetch pueden contener la URL con el token: nunca propagar sus detalles.
    if (error.fatal || error.discard) throw error;
    throw new Error('Telegram no está disponible. Volveré a conectar.');
  } finally { clearTimeout(timer); }
}

async function send(chatId, text) {
  // Telegram permite hasta 4096 caracteres por mensaje; enviar partes sin Markdown.
  for (let start = 0; start < text.length; start += 3500) {
    await telegram('sendMessage', { chat_id: chatId, text: text.slice(start, start + 3500) });
  }
}

const me = await telegram('getMe', {});
const webhook = await telegram('getWebhookInfo', {});
if (webhook.url) throw new Error('Este bot tiene un webhook configurado. Usa un bot dedicado para esta automatización.');
console.log(`Bot @${me.username} conectado. ${identifyOnly ? 'Modo identificación: solo muestra IDs; no ejecuta cambios.' : 'Escuchando peticiones autorizadas. Ctrl+C para cerrar.'}`);
const store = new Store(join(dataDir, 'state.json'));
const worker = identifyOnly ? null : new Worker(config, dataDir);

async function processQueue() {
  if (processing || stopping || identifyOnly) return;
  const job = store.state.jobs.find(j => j.status === 'queued');
  if (!job) return;
  processing = true;
  job.status = 'running'; store.save();
  console.log(`Solicitud ${job.id}: iniciada.`);
  try {
    const result = await worker.process(job, store.state.conversations[job.userId] ?? [], async text => {
      store.tell(job.chatId, text); store.save();
    });
    Object.assign(job, result, { finishedAt: new Date().toISOString() });
    remember(store, job, result.message);
    store.tell(job.chatId, result.message);
  } catch (error) {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    const dir = join(dataDir, 'jobs', job.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'failure.log'), error.stack ?? String(error));
    const text = `La solicitud ${job.id} se ha detenido. No puedo confirmar su publicación. El propietario puede revisar .telegram-bot/jobs/${job.id}/, incluidas las comprobaciones y cualquier intento de publicación. No repetiré la solicitud automáticamente.`;
    remember(store, job, text);
    store.tell(job.chatId, text);
    console.log(`Solicitud ${job.id}: detenida. Consulta el registro local.`);
  } finally { store.save(); processing = false; }
}

// Polling, cola y notificaciones se mantienen independientes; las tareas son secuenciales.
while (!stopping || processing) {
  try {
    if (stopping) { await delay(1000); continue; }
    void processQueue();
    if (store.state.outbox.length) {
      const message = store.state.outbox[0];
      try { await send(message.chatId, message.text); }
      catch (error) { if (!error.discard) throw error; console.log('Aviso descartado: el destinatario ya no admite mensajes.'); }
      store.state.outbox.shift(); store.save();
    }
    if (identifyOnly) {
      const updates = await telegram('getUpdates', { offset: store.state.offset, timeout: 10, allowed_updates: ['message'] });
      for (const update of updates) {
        const m = update.message;
        if (m?.chat?.type === 'private' && m.from && !m.from.is_bot) {
          console.log(`ID ${m.from.id} (${m.from.first_name ?? 'usuario'}).`);
          store.tell(m.chat.id, `Tu ID de Telegram es ${m.from.id}. Envíalo al propietario del bot para autorizarte.`);
        }
        store.state.offset = update.update_id + 1; store.save();
      }
    } else {
      const updates = await telegram('getUpdates', { offset: store.state.offset, timeout: 10, allowed_updates: ['message'] });
      for (const update of updates) receive(store, update, config.allowedUserIds);
    }
  } catch (error) {
    console.log(error.message);
    if (error.fatal) { stopping = true; process.exitCode = 1; }
    else await delay(5000);
  }
}

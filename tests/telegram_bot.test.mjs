import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  assertAllowedPaths, childEnvironment, DEFAULT_REPOSITORY, emptyState, receive, remember, run, Store, validateConfig, Worker,
} from '../tools/telegram-bot/core.mjs';

const testRoot = resolve('target/telegram-bot-tests');
mkdirSync(testRoot, { recursive: true });
const temp = () => mkdtempSync(join(testRoot, 'case-'));
const config = { repositoryUrl: DEFAULT_REPOSITORY, allowedUserIds: [123], codexEntry: 'C:/Codex/bin/codex.js', siteUrl: 'https://tesis-dm5l.onrender.com' };
const update = (id, text, userId = 123, type = 'private') => ({ update_id: id, message: { text, from: { id: userId, is_bot: false }, chat: { id: userId, type } } });

test('configuración rechaza ausencia de IDs y URLs con credenciales', () => {
  assert.equal(validateConfig(config), config);
  assert.throws(() => validateConfig({ ...config, allowedUserIds: [] }));
  assert.throws(() => validateConfig({ ...config, repositoryUrl: 'https://password@github.com/user/repo.git' }));
  assert.throws(() => validateConfig({ ...config, allowedUserIds: ['123'] }));
});

test('solo personas autorizadas en privado encolan trabajo; /id no autoriza', () => {
  const store = new Store(join(temp(), 'state.json'));
  receive(store, update(1, 'Cambia el juego', 456), [123]);
  receive(store, update(2, 'Cambia el juego', 123, 'group'), [123]);
  receive(store, update(3, '/id', 456), [123]);
  assert.equal(store.state.jobs.length, 0);
  assert.match(store.state.outbox[0].text, /456/);
  receive(store, update(4, 'Cambia el juego'), [123]);
  receive(store, update(4, 'Cambia el juego'), [123]);
  assert.equal(store.state.jobs.length, 1);
  assert.equal(new Store(store.path).state.offset, 5);
  assert.equal(new Store(store.path).state.jobs.length, 1);
});

test('reinicio conserva cola y marca interrupciones sin repetirlas', () => {
  const store = new Store(join(temp(), 'state.json'));
  receive(store, update(1, 'Primero'), [123]);
  receive(store, update(2, 'Segundo'), [123]);
  store.state.jobs[0].status = 'running'; store.save();
  const recovered = new Store(store.path);
  assert.equal(recovered.state.jobs[0].status, 'interrupted');
  assert.equal(recovered.state.jobs[1].status, 'queued');
  assert.match(recovered.state.outbox.at(-1).text, /No la repetiré/);
});

test('conversaciones y /estado son privados, y /nuevo no borra una tarea en curso', () => {
  const store = new Store(join(temp(), 'state.json'));
  remember(store, { userId: 123, text: 'privado A' }, 'respuesta A');
  remember(store, { userId: 456, text: 'privado B' }, 'respuesta B');
  receive(store, update(1, 'Cambio A'), [123, 456]);
  receive(store, update(2, 'Cambio B', 456), [123, 456]);
  receive(store, update(3, '/estado'), [123, 456]);
  assert.match(store.state.outbox.at(-1).text, /1: en cola/);
  assert.doesNotMatch(store.state.outbox.at(-1).text, /2: en cola/);
  receive(store, update(4, '/nuevo'), [123, 456]);
  assert.equal(store.state.conversations[123][0].text, 'privado A');
  store.state.jobs[0].status = 'answered';
  receive(store, update(5, '/nuevo'), [123, 456]);
  assert.equal(store.state.conversations[123], undefined);
  assert.equal(store.state.conversations[456][0].text, 'privado B');
});

test('secretos no se heredan y argumentos del usuario no pasan por shell', async () => {
  const env = childEnvironment({ PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT,
    TESIS_TELEGRAM_TOKEN: 'secret', SUPABASE_SECRET_KEY: 'secret', OPENAI_API_KEY: 'secret', CUSTOM_SECRET: 'secret' });
  assert.equal(env.TESIS_TELEGRAM_TOKEN, undefined);
  assert.equal(env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.CUSTOM_SECRET, undefined);
  const payload = '$(Remove-Item *) & echo injected `whoami`';
  const output = await run(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input: payload });
  assert.equal(output, payload);
});

test('solo rutas del juego y documentación pueden publicarse', () => {
  assertAllowedPaths(['src/main/java/es/tesis/Main.java', 'src/main/resources/static/css/game.css', 'src/test/java/Test.java', 'tests/game.test.mjs', 'docs/nota.md']);
  for (const path of ['supabase/migrations/test.sql', 'tools/test.mjs', 'pom.xml', 'Dockerfile', '.github/workflows/test.yml', 'AGENTS.md', 'docs/AGENTS.md', 'src/main/.env', 'src/main/../../secret']) {
    assert.throws(() => assertAllowedPaths([path]), path);
  }
});

test('Codex recibe stdin y argumentos directos con Node, sin reinterpretación PowerShell', async () => {
  const dir = temp();
  let invocation;
  const worker = new Worker(config, dir, { execute: async (file, args, opts) => {
    invocation = { file, args, opts };
    const outputPath = args[args.indexOf('-o') + 1];
    writeFileSync(outputPath, JSON.stringify({ kind: 'answer', message: 'OK', title: '' }));
    return 'OK';
  } });
  const prompt = '¿Móvil? $(whoami) & texto';
  const result = await worker.codex(dir, prompt, dir, { type: 'object' }, 'read-only');
  assert.equal(invocation.file, process.execPath);
  assert.equal(invocation.args[0], config.codexEntry);
  assert.equal(invocation.opts.input, prompt);
  assert.equal(invocation.args.includes(prompt), false);
  assert.equal(invocation.args.at(-1), '-');
  assert.equal(result.message, 'OK');
});

async function fixture(options = {}) {
  const dir = temp(), seed = join(dir, 'seed'), remote = join(dir, 'remote.git'), data = join(dir, 'bot');
  mkdirSync(seed); mkdirSync(data);
  const git = (cwd, ...args) => run('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd });
  await git(seed, 'init', '-b', 'main');
  await git(seed, 'config', 'user.name', 'Bot Test');
  await git(seed, 'config', 'user.email', 'test@example.test');
  mkdirSync(join(seed, 'src/main'), { recursive: true });
  writeFileSync(join(seed, 'src/main/game.txt'), 'original\n');
  await git(seed, 'add', '.'); await git(seed, 'commit', '-m', 'Initial');
  await git(dir, 'clone', '--bare', seed, remote);
  const base = await git(seed, 'rev-parse', 'HEAD');
  const calls = [], order = [];
  const execute = (file, args, opts) => {
    calls.push({ file, args });
    return run(file, args.map(arg => arg === DEFAULT_REPOSITORY ? remote : arg), opts);
  };
  const agent = async (cwd, prompt) => {
    order.push('agent');
    assert.match(prompt, /usuario/);
    writeFileSync(join(cwd, 'src/main/game.txt'), 'changed\n');
    return { kind: 'changed', message: 'Cambio completado.', title: 'Cambio Telegram' };
  };
  const checks = async () => { order.push('checks'); };
  const reviewer = async () => { order.push('review'); return { approved: true, message: 'Correcto' }; };
  const worker = new Worker(config, data, { execute, agent, checks, reviewer, sourceRepository: seed, wait: async () => {}, ...options });
  return { dir, seed, remote, data, git, base, worker, calls, order, job: { id: '100', userId: 123, text: 'Cambia el texto' } };
}

test('publica a main solo tras checks y revisión, sin alterar copia original', async () => {
  const f = await fixture();
  const result = await f.worker.process(f.job);
  assert.equal(result.status, 'published');
  assert.deepEqual(f.order, ['agent', 'checks', 'review']);
  assert.equal(await f.git(f.remote, 'rev-parse', 'refs/heads/main'), result.commit);
  assert.equal(readFileSync(join(f.seed, 'src/main/game.txt'), 'utf8'), 'original\n');
  assert.equal(await f.git(f.seed, 'rev-parse', 'HEAD'), f.base);
  assert.match(result.message, /aún no se ha verificado/);
  assert.equal(f.calls.filter(c => c.args.includes('push')).length, 1);
  assert.equal(f.calls.some(c => c.args.includes('--force')), false);
});

test('fallo de tests bloquea revisión y push', async () => {
  const f = await fixture({ checks: async () => { throw new Error('test failed'); } });
  await assert.rejects(f.worker.process(f.job), /test failed/);
  assert.equal(await f.git(f.remote, 'rev-parse', 'main'), f.base);
  assert.equal(f.calls.some(c => c.args.includes('push')), false);
});

test('revisión denegada bloquea push', async () => {
  const f = await fixture({ reviewer: async () => ({ approved: false, message: 'Regresión' }) });
  await assert.rejects(f.worker.process(f.job), /no aprobó/);
  assert.equal(f.calls.some(c => c.args.includes('push')), false);
});

test('infraestructura modificada bloquea pruebas y push', async () => {
  const f = await fixture({ agent: async cwd => {
    writeFileSync(join(cwd, 'pom.xml'), 'malicious');
    return { kind: 'changed', message: 'Changed', title: 'Changed' };
  } });
  await assert.rejects(f.worker.process(f.job), /intervención/);
  assert.equal(f.calls.some(c => c.args.includes('push')), false);
  assert.equal(f.order.includes('checks'), false);
});

test('main concurrente bloquea push y conserva ambos cambios', async () => {
  const f = await fixture();
  f.worker.checks = async () => {
    writeFileSync(join(f.seed, 'src/main/game.txt'), 'otro cambio\n');
    await f.git(f.seed, 'add', '.'); await f.git(f.seed, 'commit', '-m', 'Concurrent');
    await f.git(f.seed, 'push', f.remote, 'HEAD:main');
  };
  await assert.rejects(f.worker.process(f.job), /main cambió/);
  assert.equal(f.calls.some(c => c.args.includes('push')), false);
  assert.notEqual(await f.git(f.remote, 'rev-parse', 'main'), f.base);
});

test('pregunta sin cambios no publica y responde a la persona', async () => {
  const f = await fixture({ agent: async () => ({ kind: 'question', message: '¿En móvil o escritorio?', title: '' }) });
  const result = await f.worker.process(f.job);
  assert.equal(result.status, 'answered');
  assert.match(result.message, /móvil/);
  assert.equal(f.calls.some(c => c.args.includes('push')), false);
});

test('pregunta con cambios y pruebas que alteran el patch bloquean publicación', async () => {
  const f = await fixture({ agent: async cwd => {
    writeFileSync(join(cwd, 'src/main/game.txt'), 'incompleto');
    return { kind: 'question', message: '¿Cómo?', title: '' };
  } });
  await assert.rejects(f.worker.process(f.job), /sin una implementación/);
  const g = await fixture({ checks: async cwd => writeFileSync(join(cwd, 'src/main/game.txt'), 'mutado por tests') });
  await assert.rejects(g.worker.process(g.job), /modificaron el cambio/);
  assert.equal(g.calls.some(c => c.args.includes('push')), false);
});

test('estado vacío no contiene identidades ni mensajes compartidos', () => {
  assert.deepEqual(emptyState(), { offset: 0, jobs: [], conversations: {}, outbox: [] });
});

test('la copia local excluye trabajo sin commit y secretos, y usa el main remoto más reciente', async () => {
  const f = await fixture();
  const other = join(f.dir, 'other');
  await f.git(f.dir, 'clone', f.remote, other);
  writeFileSync(join(other, 'src/main/game.txt'), 'main remoto nuevo\n');
  await f.git(other, 'add', '.');
  await f.git(other, '-c', 'user.name=Other', '-c', 'user.email=other@example.test', 'commit', '-m', 'New remote main');
  await f.git(other, 'push', f.remote, 'HEAD:main');
  writeFileSync(join(f.seed, 'src/main/game.txt'), 'trabajo local sin commit\n');
  mkdirSync(join(f.seed, '.telegram-bot'));
  writeFileSync(join(f.seed, '.telegram-bot/token.dpapi'), 'dato privado local');
  f.worker.agent = async cwd => {
    assert.equal(readFileSync(join(cwd, 'src/main/game.txt'), 'utf8').trim(), 'main remoto nuevo');
    assert.equal(existsSync(join(cwd, '.telegram-bot/token.dpapi')), false);
    return { kind: 'answer', message: 'Consulta respondida', title: '' };
  };
  const result = await f.worker.process(f.job);
  assert.equal(result.status, 'answered');
  assert.equal(readFileSync(join(f.seed, 'src/main/game.txt'), 'utf8'), 'trabajo local sin commit\n');
  const clone = f.calls.find(call => call.args.includes('clone'));
  assert.equal(clone.args.includes(f.seed), true);
  assert.equal(clone.args.includes(DEFAULT_REPOSITORY), false);
});

test('fallos transitorios de fetch se reintentan sin repetir la tarea ni el push', async () => {
  const f = await fixture();
  const execute = f.worker.execute;
  let fetches = 0;
  f.worker.execute = async (file, args, opts) => {
    if (args.includes('fetch') && ++fetches < 3) throw new Error('RPC failed; curl 18; early EOF');
    return execute(file, args, opts);
  };
  const result = await f.worker.process(f.job);
  assert.equal(result.status, 'published');
  assert.equal(fetches, 3);
  assert.equal(f.order.filter(step => step === 'agent').length, 1);
  assert.equal(f.calls.filter(call => call.args.includes('push')).length, 1);
});

test('fetch persistente se detiene antes de Codex y errores de autenticación no se reintentan', async () => {
  for (const [failure, expected] of [['RPC failed; early EOF', 3], ['Permission denied', 1]]) {
    const f = await fixture();
    const execute = f.worker.execute;
    let fetches = 0;
    f.worker.execute = async (file, args, opts) => {
      if (args.includes('fetch')) { fetches++; throw new Error(failure); }
      return execute(file, args, opts);
    };
    await assert.rejects(f.worker.process(f.job), error => error.code === 'PREPARE_FAILED');
    assert.equal(fetches, expected);
    assert.equal(f.order.length, 0);
    assert.equal(f.calls.some(call => call.args.includes('push')), false);
  }
});

test('un fallo de red después de publicar no provoca otro push', async () => {
  const f = await fixture();
  const execute = f.worker.execute;
  let pushes = 0;
  f.worker.execute = async (file, args, opts) => {
    if (args.includes('push')) {
      pushes++;
      await execute(file, args, opts);
      throw new Error('RPC failed; respuesta perdida después del push');
    }
    return execute(file, args, opts);
  };
  await assert.rejects(f.worker.process(f.job), /respuesta perdida/);
  assert.equal(pushes, 1);
  const publication = JSON.parse(readFileSync(join(f.data, 'jobs', f.job.id, 'publication.json'), 'utf8'));
  assert.equal(await f.git(f.remote, 'rev-parse', 'main'), publication.commit);
});

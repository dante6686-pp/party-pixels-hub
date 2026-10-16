import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Run the workspace from the repo root; also accept preview supervisors' host/port flags.
const args=process.argv.slice(2);
function option(names,fallback){const index=args.findIndex(value=>names.includes(value));return index>=0?args[index+1]:fallback;}
const child=spawn(process.execPath,[
  fileURLToPath(import.meta.resolve('next/dist/bin/next')),'dev',
  fileURLToPath(new URL('../apps/hub',import.meta.url)),
  '--hostname',option(['--host','--hostname'],process.env.HOST??'0.0.0.0'),
  '--port',option(['--port'],process.env.PORT??'3000'),
],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));

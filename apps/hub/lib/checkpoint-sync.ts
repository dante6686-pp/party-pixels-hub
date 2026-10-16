import {checkpoint,saveKey,type Checkpoint} from './game-protocol.ts';

export type CloudSnapshot={revision:number;checkpoint:Checkpoint|null};
type Job={expectedRevision:number;requestId:string;checkpoint:Checkpoint};
type Envelope={version:1;revision:number;checkpoint:Checkpoint|null;pending:Job[]};
export type SyncStatus='loading'|'cloud'|'device'|'pending'|'conflict'|'error';
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
type Transport={load:()=>Promise<unknown>;save:(job:Job)=>Promise<unknown>};
export function cloudSnapshot(value:unknown):CloudSnapshot {
  const v=value as Partial<CloudSnapshot>|null;
  if(!v||!Number.isSafeInteger(v.revision)||v.revision!<0)throw Error('INVALID_SAVE_RESPONSE');
  const cp=checkpoint(v.checkpoint);
  if(v.revision===0&&v.checkpoint===null)return {revision:0,checkpoint:null};
  if(!cp||v.revision===0)throw Error('INVALID_SAVE_RESPONSE');
  return {revision:v.revision!,checkpoint:cp};
}
/** One durable ordered queue per account. CAS prevents a stale device from overwriting another. */
export class CheckpointSync {
  private state:Envelope={version:1,revision:0,checkpoint:null,pending:[]};
  private status:SyncStatus='loading';
  private work:Promise<void>|null=null;
  private stopped=false;
  private initialized=false;
  readonly key:string;
  private owner:string|null;
  private storage:Storage;
  private transport:Transport|null;
  private changed:(status:SyncStatus,snapshot:CloudSnapshot)=>void;
  private uuid:()=>string;
  constructor(owner:string|null,storage:Storage,transport:Transport|null,
    changed:(status:SyncStatus,snapshot:CloudSnapshot)=>void,uuid:()=>string=()=>crypto.randomUUID()) {
    this.owner=owner;this.storage=storage;this.transport=transport;this.changed=changed;this.uuid=uuid;
    this.key=saveKey(owner)+':sync';
  }
  private emit(status:SyncStatus){this.status=status;if(!this.stopped)this.changed(status,this.snapshot());}
  snapshot():CloudSnapshot{return {revision:this.state.revision,checkpoint:this.state.checkpoint?{...this.state.checkpoint}:null};}
  private persist(){
    this.storage.setItem(this.key,JSON.stringify(this.state));
    // Compatibility cache only; the envelope and queue above are authoritative.
    try{this.storage.setItem(saveKey(this.owner),JSON.stringify(this.state.checkpoint));}catch{}
  }
  private read():Envelope|null {
    try{
      const e=JSON.parse(this.storage.getItem(this.key)??'null');
      if(e?.version!==1||!Number.isSafeInteger(e.revision)||e.revision<0||!Array.isArray(e.pending)||e.pending.length>32)return null;
      if(e.checkpoint!==null&&!checkpoint(e.checkpoint))return null;
      for(let i=0;i<e.pending.length;i++){
        const job=e.pending[i];
        if(job.expectedRevision!==e.revision+i||!checkpoint(job.checkpoint)||! /^[0-9a-f-]{36}$/i.test(job.requestId))return null;
      }
      if(e.pending.length&&JSON.stringify(e.pending.at(-1).checkpoint)!==JSON.stringify(e.checkpoint))return null;
      return e;
    }catch{return null;}
  }
  async load():Promise<CloudSnapshot> {
    this.emit('loading');const cached=this.read();
    if(!this.owner){
      let cp=null;try{cp=checkpoint(JSON.parse(this.storage.getItem(saveKey(null))??'null'));}catch{}
      this.state={version:1,revision:0,checkpoint:cp,pending:[]};this.initialized=true;this.emit('device');return this.snapshot();
    }
    if(!this.transport)throw Error('CLOUD_UNAVAILABLE');
    const remote=cloudSnapshot(await this.transport.load());if(this.stopped)return remote;
    if(cached?.pending.length){this.state=cached;this.initialized=true;await this.flush();return this.snapshot();}
    this.state={version:1,...remote,pending:[]};this.initialized=true;
    // Import only the legacy cache belonging to this exact account, and only into an empty cloud slot.
    let legacy=null;try{legacy=checkpoint(JSON.parse(this.storage.getItem(saveKey(this.owner))??'null'));}catch{}
    if(remote.revision===0&&legacy){this.enqueue(legacy);await this.flush();}
    else{try{this.persist();}catch{}this.emit('cloud');}
    return this.snapshot();
  }
  enqueue(value:Checkpoint):void {
    const cp=checkpoint(value);if(!cp||!this.initialized||this.stopped)throw Error('INVALID_CHECKPOINT');
    if(this.status==='conflict')throw Error('SAVE_CONFLICT');
    if(this.state.pending.length>=32)throw Error('SAVE_QUEUE_FULL');
    const previous=this.state;
    this.state={...previous,checkpoint:cp,pending:this.owner?[...previous.pending,{expectedRevision:previous.revision+previous.pending.length,requestId:this.uuid(),checkpoint:cp}]:[]};
    try{this.persist();}catch{this.state=previous;throw Error('LOCAL_SAVE_FAILED');}
    this.emit(this.owner?'pending':'device');
    if(this.owner)void this.flush();
  }
  flush():Promise<void> {
    if(this.work)return this.work;
    if(this.stopped||!this.owner||!this.transport||this.status==='conflict')return Promise.resolve();
    this.work=this.drain().finally(()=>{this.work=null;});return this.work;
  }
  private async drain() {
    while(this.state.pending.length&&!this.stopped){
      const job=this.state.pending[0];
      try{
        const remote=cloudSnapshot(await this.transport!.save(job));
        if(this.stopped)return;
        if(remote.revision!==job.expectedRevision+1||JSON.stringify(remote.checkpoint)!==JSON.stringify(job.checkpoint))throw Error('INVALID_SAVE_RESPONSE');
        this.state={...this.state,revision:remote.revision,pending:this.state.pending.slice(1)};
        // If persisting the receipt fails, a reload retries the old request id safely.
        try{this.persist();}catch{}
      }catch(error){
        const message=error instanceof Error?error.message:'';
        this.emit(message.includes('SAVE_CONFLICT')||message.includes('DUPLICATE_CONFLICT')?'conflict':'pending');return;
      }
    }
    if(!this.stopped)this.emit('cloud');
  }
  async useCloud():Promise<CloudSnapshot> {
    if(!this.transport||this.stopped)throw Error('CLOUD_UNAVAILABLE');
    const remote=cloudSnapshot(await this.transport.load());
    // Keep the conflicting local queue available for recovery instead of silently destroying it.
    this.storage.setItem(this.key+':conflict-backup',JSON.stringify(this.state));
    this.state={version:1,...remote,pending:[]};this.persist();this.emit('cloud');return this.snapshot();
  }
  getStatus(){return this.status;}
  dispose(){this.stopped=true;}
}

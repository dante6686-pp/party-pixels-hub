'use client';

import {useEffect, useState, type FormEvent} from 'react';
import type {User} from '@supabase/supabase-js';
import {getClient, avatars, type Profile} from '../lib/client';
import Arcade from './arcade';
import GameLibrary from './game-library';
import Friends from './friends';

type Mode = 'login' | 'signup' | 'reset' | 'password';
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [avatar, setAvatar] = useState<keyof typeof avatars>('ghost');
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  useEffect(() => {
    const supabase = getClient();
    if (!supabase) {setLoading(false); return;}
    let active = true;
    let revision = 0;
    // The auth callback only updates identity. Profile queries run in a separate effect.
    const {data: {subscription}} = supabase.auth.onAuthStateChange((event, session) => {
      revision++;
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setMode('password');
    });
    const initialRevision = revision;
    void supabase.auth.getUser().then(({data}) => {
      if (active && revision === initialRevision) {setUser(data.user); setLoading(false);}
    }).catch(() => {if (active) {setLoading(false); setNotice('Nie udało się sprawdzić sesji. Odśwież stronę.');}});
    return () => {active = false; subscription.unsubscribe();};
  }, []);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setAvatar('ghost');
    if (!user) return;
    const supabase = getClient();
    if (!supabase) return;
    void supabase.from('profiles').select('player_id,handle,display_name,avatar_key').eq('player_id', user.id).maybeSingle().then(({data,error}) => {
      if (!active) return;
      if (error) setNotice('Nie udało się odczytać profilu. Spróbuj ponownie.');
      else if (data) {setProfile(data as Profile); setAvatar(data.avatar_key as keyof typeof avatars);}
    });
    return () => {active = false;};
  }, [user?.id]);

  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getClient();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true); setNotice('');
    try {
      if (mode === 'signup') {
        const {data,error} = await supabase.auth.signUp({email,password,options:{emailRedirectTo: window.location.origin}});
        if (error) throw error;
        setNotice(data.session ? 'Konto gotowe. Uzupełnij profil.' : 'Sprawdź skrzynkę i potwierdź adres e-mail, a potem wróć się zalogować.');
      } else if (mode === 'reset') {
        const {error} = await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
        if (error) throw error;
        setNotice('Jeśli konto istnieje, otrzymasz wiadomość z linkiem do zmiany hasła.');
      } else if (mode === 'password') {
        const {error} = await supabase.auth.updateUser({password});
        if (error) throw error;
        setMode('login'); setNotice('Hasło zmienione.');
      } else {
        const {error} = await supabase.auth.signInWithPassword({email,password});
        if (error) throw error;
        setNotice('Witaj ponownie!');
      }
    } catch {
      setNotice(mode === 'login' ? 'Nie udało się zalogować. Sprawdź dane i potwierdzenie adresu e-mail.' : 'Operacja nie powiodła się. Sprawdź dane lub spróbuj za chwilę.');
    } finally {setBusy(false);}
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getClient();
    if (!supabase || !user) return;
    const form = new FormData(event.currentTarget);
    const handle = String(form.get('handle')).trim().toLowerCase();
    const displayName = String(form.get('display_name')).trim();
    if (!/^[a-z0-9_]{3,20}$/.test(handle) || displayName.length < 1 || displayName.length > 40) {
      setNotice('Nick: 3–20 małych liter, cyfr lub _. Nazwa: 1–40 znaków.'); return;
    }
    setBusy(true); setNotice('');
    try {
      const {data:authData,error:authError} = await supabase.auth.getUser();
      if (authError || authData.user?.id !== user.id) {setNotice('Sesja wygasła. Zaloguj się ponownie.'); return;}
      const values: Profile = {player_id:user.id,handle,display_name:displayName,avatar_key:avatar};
      const {data,error} = await supabase.from('profiles').upsert(values,{onConflict:'player_id'}).select('player_id,handle,display_name,avatar_key').single();
      if (error) {setNotice(error.code === '23505' ? 'Ten nick jest już zajęty. Wybierz inny.' : 'Nie udało się zapisać profilu. Spróbuj ponownie.'); return;}
      setProfile(data as Profile); setNotice('Profil zapisany.');
    } catch {setNotice('Brak połączenia. Spróbuj ponownie.');}
    finally {setBusy(false);}
  }

  async function logout() {
    const supabase = getClient();
    if (!supabase) return;
    setBusy(true);
    try {
      const {error} = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null); setProfile(null); setMode('login'); setNotice('Wylogowano.');
    } catch {setNotice('Nie udało się wylogować. Spróbuj ponownie.');}
    finally {setBusy(false);}
  }

  return <main>
    <header><a className="brand" href="/" aria-label="Party Pixels — strona główna"><span className="brand-icon">✳</span>party<span>pixels</span><sup>2.0</sup></a><span className="dev-label">WCZESNA WERSJA</span></header>
    <GameLibrary/>
    <div className="columns"><section className="intro"><p className="eyebrow"><i/> MAŁE GRY. WIELKIE EMOCJE.</p><h1>Najlepsze chwile?<br/>Te <span>razem.</span></h1><p className="lead">Jedno konto na wszystkie Twoje przyszłe rozgrywki. Wybierz swój nick, znajdź swój styl i przygotuj się na Party Pixels.</p>
      <div className="pixel-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="mascot">👾</div><span className="spark s1">✦</span><span className="spark s2">+</span><span className="spark s3">✳</span><div className="sticker">PLAYER ONE<br/><b>THAT’S YOU.</b></div></div>
      <p className="footnote">Budujemy nowe Party Pixels. Gry i funkcje społecznościowe pojawią się w kolejnych etapach.</p></section>
    <section className="account" aria-label="Konto gracza"><div className="card-top"><span>TWÓJ KĄCIK GRACZA</span><span>↗</span></div>
      {!configured ? <div className="setup"><h2>Jeszcze chwila.</h2><p>Ta wersja czeka na podłączenie kont graczy. Wróć po zakończeniu konfiguracji.</p></div> : loading ? <p role="status">Sprawdzam sesję…</p> : user && mode !== 'password' ? <>
        <div className="profile-heading"><span className="avatar-preview">{avatars[avatar]}</span><div><p className="eyebrow">DOBRZE CIĘ WIDZIEĆ</p><h2>{profile?.display_name || 'Twój ruch.'}</h2></div></div>
        <p className="muted">{profile ? 'To Twój wspólny profil Party Pixels.' : 'Wybierz nick i avatar, żeby dokończyć profil.'}</p>
        <form onSubmit={saveProfile} key={user.id + (profile?.handle ?? '')}><fieldset disabled={busy}>
          <label htmlFor="handle">Nick gracza</label><input id="handle" name="handle" defaultValue={profile?.handle ?? ''} pattern="[a-z0-9_]{3,20}" minLength={3} maxLength={20} required autoComplete="username" aria-describedby="handle-hint"/><small id="handle-hint">3–20 małych liter, cyfr lub podkreśleń.</small>
          <label htmlFor="display_name">Wyświetlana nazwa</label><input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} maxLength={40} required autoComplete="nickname"/>
          <span className="field-label" id="avatar-label">Wybierz avatar</span><div className="avatars" role="group" aria-labelledby="avatar-label">{Object.entries(avatars).map(([key,value]) => <button className={avatar === key ? 'selected' : ''} type="button" key={key} aria-label={{ghost:'Duch',bolt:'Błyskawica',cat:'Kot',planet:'Planeta'}[key]} aria-pressed={avatar === key} onClick={() => setAvatar(key as keyof typeof avatars)}>{value}</button>)}</div>
          <button className="primary" type="submit">{busy ? 'Zapisuję…' : 'Zapisz profil'} <span>→</span></button>
        </fieldset></form><button className="text-button" disabled={busy} onClick={logout}>Wyloguj się</button>
      </> : <>
        <h2>{mode === 'signup' ? 'Dołącz do ekipy.' : mode === 'reset' ? 'Wracamy do gry.' : mode === 'password' ? 'Nowe hasło.' : 'Wskakuj do środka.'}</h2>
        <p className="muted">{mode === 'signup' ? 'Pierwszy krok do Twojego miejsca w Party Pixels.' : mode === 'reset' ? 'Wyślemy Ci link do ustawienia nowego hasła.' : mode === 'password' ? 'Ustaw nowe hasło do konta.' : 'Twój profil czeka. Zaloguj się, żeby go otworzyć.'}</p>
        {(mode === 'login' || mode === 'signup') && <div className="tabs"><button aria-pressed={mode === 'login'} onClick={() => {setMode('login'); setNotice('');}} disabled={busy}>Logowanie</button><button aria-pressed={mode === 'signup'} onClick={() => {setMode('signup'); setNotice('');}} disabled={busy}>Nowe konto</button></div>}
        <form onSubmit={auth}><fieldset disabled={busy}>
          {mode !== 'password' && <><label htmlFor="email">Adres e-mail</label><input id="email" name="email" type="email" placeholder="ty@example.com" required autoComplete="email" maxLength={254}/></>}
          {mode !== 'reset' && <><label htmlFor="password">Hasło</label><input id="password" name="password" type="password" required minLength={mode === 'login' ? 1 : 12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>{mode !== 'login' && <small>Minimum 12 znaków.</small>}</>}
          <button className="primary" type="submit">{busy ? 'Chwileczkę…' : mode === 'signup' ? 'Utwórz konto' : mode === 'reset' ? 'Wyślij link' : mode === 'password' ? 'Zapisz nowe hasło' : 'Zaloguj się'} <span>→</span></button>
        </fieldset></form>
        {mode === 'login' && <button className="text-button" disabled={busy} onClick={() => {setMode('reset');setNotice('');}}>Nie pamiętasz hasła?</button>}
        {mode === 'reset' && <button className="text-button" disabled={busy} onClick={() => {setMode('login');setNotice('');}}>Wróć do logowania</button>}
      </>}
      {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
      <div className="card-bottom"><span className="dot"/> JEDEN PROFIL. TWOJE PARTY PIXELS.</div>
    </section></div>{user&&profile?.player_id===user.id&&mode!=='password'&&<><Friends key={user.id} owner={user.id}/><Arcade key={user.id} profile={profile}/></>}<footer><span>© Party Pixels 2026</span><span>Made for good times.</span></footer>
  </main>;
}

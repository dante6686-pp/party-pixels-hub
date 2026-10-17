import type { Metadata,Viewport } from 'next';
import './globals.css';
import AppearanceProvider from './appearance-provider';

export const metadata: Metadata = {
  title: 'Party Pixels — wejdź do gry',
  description: 'Twoje konto gracza Party Pixels. Jeden profil, wspólne granie.',
  robots: {index: false, follow: false},
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#111116'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="pl"><body><AppearanceProvider/>{children}</body></html>;
}

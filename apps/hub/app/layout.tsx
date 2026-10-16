import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Party Pixels — wejdź do gry',
  description: 'Twoje konto gracza Party Pixels. Jeden profil, wspólne granie.',
  robots: {index: false, follow: false},
};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="pl"><body>{children}</body></html>;
}

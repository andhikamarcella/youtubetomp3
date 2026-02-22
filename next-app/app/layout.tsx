import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/global.css';
import SeasonalBackground from '../components/SeasonalBackground';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SeasonalBackground />
        <div className="app-foreground">{children}</div>
      </body>
    </html>
  );
}


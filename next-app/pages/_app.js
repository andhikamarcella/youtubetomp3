import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/global.css';
import SeasonalBackground from '../components/SeasonalBackground';

export default function App({ Component, pageProps }) {
  return (
    <>
      <SeasonalBackground />
      <div className="app-foreground">
        <Component {...pageProps} />
      </div>
    </>
  );
}

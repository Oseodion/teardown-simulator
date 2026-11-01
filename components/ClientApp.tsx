'use client';
import dynamic from 'next/dynamic';

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => (
    <main className="app">
      <div className="loading mono">LOADING SIMULATOR</div>
    </main>
  ),
});

export default function ClientApp() {
  return <App />;
}

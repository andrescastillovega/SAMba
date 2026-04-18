import { Link, Route, Routes } from 'react-router-dom';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ModelLoadingOverlay from './components/ModelLoadingOverlay';
import ToastHost from './components/ToastHost';

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-3 backdrop-blur">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Drone-Traffic Annotator
        </Link>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </main>
      <ModelLoadingOverlay />
      <ToastHost />
    </div>
  );
}

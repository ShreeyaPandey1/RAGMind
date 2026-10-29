import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  FolderOpen,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Menu,
  X,
  UploadCloud,
  FileSearch,
  Sparkles,
  Database
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { documentsApi } from '../../api/client';

export const AppShell: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ragmind_theme') as 'light' | 'dark') || 'light';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickUploadOpen, setIsQuickUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ragmind_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const navItems = [
    { label: 'Workspace Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Ask RAGMind', path: '/chat', icon: MessageSquare },
    { label: 'Document Library', path: '/documents', icon: FileText },
    { label: 'Document Viewer', path: '/viewer', icon: FileSearch },
    { label: 'Collections', path: '/collections', icon: FolderOpen },
    { label: 'Settings & Health', path: '/settings', icon: SettingsIcon },
  ];

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await documentsApi.upload(uploadFile);
      setIsUploading(false);
      setIsQuickUploadOpen(false);
      setUploadFile(null);
      navigate('/documents');
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err.message || 'Failed to upload document.');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/80 bg-card/60 backdrop-blur-sm z-30 select-none">
        {/* Brand */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-border/60">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              RAGMind
              <Badge variant="indigo" size="sm">v1.0</Badge>
            </h1>
            <p className="text-[11px] text-muted-foreground font-normal">AI Knowledge Engine</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-b border-border/40">
          <Button
            variant="primary"
            size="sm"
            className="w-full shadow-xs gap-1.5"
            onClick={() => setIsQuickUploadOpen(true)}
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document
          </Button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info & Engine Status */}
        <div className="p-4 border-t border-border/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online
            </span>
            <span className="text-[10px] text-muted-foreground/80">pgvector ready</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 px-4 md:px-8 border-b border-border/80 flex items-center justify-between bg-card/40 backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-foreground capitalize">
                {location.pathname.replace('/', '') || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-64 bg-card p-6 flex flex-col h-full shadow-2xl border-r border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">RAGMind</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="mt-6 space-y-2 flex-1">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Quick Upload Modal */}
      <Modal
        isOpen={isQuickUploadOpen}
        onClose={() => setIsQuickUploadOpen(false)}
        title="Upload Document"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Upload PDF, DOCX, TXT, or Markdown documents to index with chunking and embeddings.
          </p>

          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              id="quick-upload-input"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="quick-upload-input" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="w-8 h-8 text-primary/70 mb-2" />
              <span className="text-xs font-medium text-foreground">
                {uploadFile ? uploadFile.name : 'Choose a document or drop here'}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">PDF, DOCX, TXT, MD up to 25MB</span>
            </label>
          </div>

          {uploadError && (
            <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
              {uploadError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUploading}
              disabled={!uploadFile}
            >
              Start Ingestion
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

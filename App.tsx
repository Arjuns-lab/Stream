
import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Search, Download, User, Settings, 
  Play, Plus, Info, ChevronRight, Sun, Moon,
  Palette, Film, Shield, X, ArrowLeft, Pause, Trash2, Wifi, WifiOff, HardDrive, Check, Clock, List,
  Hourglass, AlertCircle, FileDown
} from 'lucide-react';
import { Movie, AppView, Theme, DownloadItem, WatchProgress } from './types';
import { INITIAL_MOVIES, CATEGORIES } from './services/mockData';
import { getGeminiRecommendations, searchMoviesWithGemini } from './services/geminiService';
import { saveVideo, getVideo, deleteVideo, getStorageEstimate } from './services/offlineStorage';
import VideoPlayer from './components/VideoPlayer';
import AdminPanel from './components/AdminPanel';

// Simple Toast Component
interface ToastProps {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: (id: number) => void;
}
const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => onClose(id), 3000);
        return () => clearTimeout(timer);
    }, [id, onClose]);

    const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';

    return (
        <div className={`${bg} text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 min-w-[300px]`}>
            {type === 'success' ? <Check size={18} /> : type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
            <span className="text-sm font-medium">{message}</span>
            <button onClick={() => onClose(id)} className="ml-auto hover:bg-white/20 p-1 rounded"><X size={14} /></button>
        </div>
    );
};

export default function App() {
  const [view, setView] = useState<AppView>(AppView.HOME);
  const [currentTheme, setCurrentTheme] = useState<Theme>('midnight');
  const [movies, setMovies] = useState<Movie[]>(INITIAL_MOVIES);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | undefined>(undefined);
  
  // Initialize downloads from localStorage (Metadata only)
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    const saved = localStorage.getItem('downloads');
    return saved ? JSON.parse(saved) : [];
  });

  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' | 'info' }[]>([]);
  const [realStorage, setRealStorage] = useState({ usage: 0, quota: 0 });

  // Watchlist State
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  // Continue Watching State
  const [watchProgress, setWatchProgress] = useState<WatchProgress[]>(() => {
      const saved = localStorage.getItem('watchProgress');
      return saved ? JSON.parse(saved) : [];
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Simulating User History for Recommendations
  const [watchHistory, setWatchHistory] = useState<Movie[]>([]);

  // Keep track of active download controllers to allow aborting
  const activeDownloadsRef = useRef<Map<string, AbortController>>(new Map());

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  };

  const removeToast = (id: number) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    // Apply theme to body
    document.body.className = `theme-${currentTheme}`;
    updateStorageEstimate();
  }, [currentTheme]);

  // Save downloads metadata to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('downloads', JSON.stringify(downloads));
  }, [downloads]);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Save progress to localStorage
  useEffect(() => {
      localStorage.setItem('watchProgress', JSON.stringify(watchProgress));
  }, [watchProgress]);

  // --- Queue Processor ---
  useEffect(() => {
      // Check if we have available slots (Max 1 concurrent download)
      const activeCount = downloads.filter(d => d.status === 'downloading').length;
      if (activeCount === 0) {
          const nextInQueue = downloads.find(d => d.status === 'queued');
          if (nextInQueue) {
              const movie = movies.find(m => m.id === nextInQueue.movieId);
              if (movie) {
                  executeDownload(movie);
              }
          }
      }
  }, [downloads]);

  const updateStorageEstimate = async () => {
      const estimate = await getStorageEstimate();
      setRealStorage(estimate);
  };

  const handlePlay = async (movie: Movie) => {
    // Add to recommendation history only if unique
    if (!watchHistory.some(m => m.id === movie.id)) {
        setWatchHistory(prev => [...prev, movie]);
    }
    
    // Check for offline blob
    try {
        const blob = await getVideo(movie.id);
        if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            setActiveVideoSrc(objectUrl);
        } else {
            setActiveVideoSrc(undefined);
        }
    } catch (e) {
        console.error("Failed to load offline video", e);
        setActiveVideoSrc(undefined);
    }

    setActiveMovie(movie);
    setView(AppView.PLAYER);
  };

  const handlePlayerClose = (progress?: number, duration?: number) => {
      if (activeVideoSrc) {
          URL.revokeObjectURL(activeVideoSrc); // Clean up memory
          setActiveVideoSrc(undefined);
      }

      if (activeMovie && progress !== undefined && duration !== undefined && duration > 0) {
          // Save progress
          setWatchProgress(prev => {
              const filtered = prev.filter(p => p.movieId !== activeMovie.id);
              // Only save if progress > 5% and < 95%
              const percentage = (progress / duration) * 100;
              if (percentage > 5 && percentage < 95) {
                  return [{
                      movieId: activeMovie.id,
                      timestamp: progress,
                      totalDuration: duration,
                      lastWatched: Date.now()
                  }, ...filtered];
              }
              return filtered; // Remove if finished or barely started
          });
      }
      setActiveMovie(null);
      setView(AppView.HOME);
  };

  const toggleWatchlist = (movieId: string) => {
      setWatchlist(prev => {
          if (prev.includes(movieId)) {
              addToast("Removed from My List", "info");
              return prev.filter(id => id !== movieId);
          } else {
              addToast("Added to My List", "success");
              return [...prev, movieId];
          }
      });
  };

  // User Action: Request Download
  const requestDownload = (movie: Movie) => {
      const existing = downloads.find(d => d.movieId === movie.id);
      
      // If paused, delete partial and restart (simplification for now)
      if (existing && existing.status === 'paused') {
          deleteDownload(movie.id, false); // Keep metadata ref, but clear partials
          // Fall through to queue logic
      } else if (existing) {
          return; // Already exists
      }

      const activeCount = downloads.filter(d => d.status === 'downloading').length;
      
      const newItem: DownloadItem = {
          movieId: movie.id,
          progress: 0,
          status: activeCount === 0 ? 'downloading' : 'queued',
          expiry: Date.now() + 172800000, // 48 hours
          totalSizeMB: 0,
          downloadedSizeMB: 0,
          speed: 0
      };

      setDownloads(prev => {
          const filtered = prev.filter(d => d.movieId !== movie.id);
          return [...filtered, newItem];
      });

      if (activeCount > 0) {
          addToast("Added to Download Queue", "info");
      } else {
          // It will be picked up by effect, but we can also trigger immediate execution state here
          // However, reliance on effect is cleaner. The effect will see status 'downloading' is 0 (because we just set state, but effect runs after render)
          // Actually, if we set status 'downloading' immediately in state, the effect won't pick it up as "next in queue".
          // But wait, we set it to 'downloading' in the state update above if activeCount is 0.
          // So we need to call executeDownload manually if we set it to downloading immediately.
          executeDownload(movie);
      }
  };

  // System Action: Execute Download
  const executeDownload = async (movie: Movie) => {
      // Ensure state reflects downloading
      setDownloads(prev => prev.map(d => d.movieId === movie.id ? { ...d, status: 'downloading' } : d));
      addToast(`Downloading ${movie.title}...`, "info");

      const controller = new AbortController();
      activeDownloadsRef.current.set(movie.id, controller);

      try {
        const response = await fetch(movie.videoUrl, { signal: controller.signal });
        if (!response.body) throw new Error('ReadableStream not supported.');

        const contentLength = response.headers.get('Content-Length');
        const totalLength = contentLength ? parseInt(contentLength, 10) : 0;
        const totalSizeMB = totalLength / (1024 * 1024);

        if (totalLength > 0) {
            setDownloads(prev => prev.map(d => 
               d.movieId === movie.id ? { ...d, totalSizeMB } : d
           ));
       }

       const reader = response.body.getReader();
       const chunks = [];
       let receivedLength = 0;
       let lastTime = Date.now();
       let lastReceived = 0;

       while(true) {
           const { done, value } = await reader.read();
           if (done) break;

           chunks.push(value);
           receivedLength += value.length;
           const currentSizeMB = receivedLength / (1024 * 1024);

           const now = Date.now();
           if (now - lastTime > 800) { // Update UI every 800ms
               const bytesDiff = receivedLength - lastReceived;
               const timeDiff = (now - lastTime) / 1000;
               const speed = (bytesDiff / (1024 * 1024)) / timeDiff; // MB/s
               
               const progress = totalLength > 0 ? (receivedLength / totalLength) * 100 : 0;

               setDownloads(prev => prev.map(d => 
                   d.movieId === movie.id ? { 
                       ...d, 
                       progress, 
                       downloadedSizeMB: currentSizeMB,
                       totalSizeMB: totalLength > 0 ? totalSizeMB : currentSizeMB,
                       speed 
                   } : d
               ));
               
               lastTime = now;
               lastReceived = receivedLength;
           }
       }

       const blob = new Blob(chunks, { type: 'video/mp4' });
       await saveVideo(movie.id, blob);
       await updateStorageEstimate();

       setDownloads(prev => prev.map(d => 
           d.movieId === movie.id ? { ...d, status: 'completed', progress: 100, speed: 0 } : d
       ));
       addToast(`${movie.title} Downloaded`, "success");

      } catch (err: any) {
        if (err.name === 'AbortError') {
            console.log('Download aborted');
            // State is updated by pauseDownload usually, but if it was automated:
            setDownloads(prev => prev.map(d => 
                d.movieId === movie.id && d.status === 'downloading' ? { ...d, status: 'paused', speed: 0 } : d
            ));
        } else {
            console.error('Download failed', err);
             setDownloads(prev => prev.map(d => 
                d.movieId === movie.id ? { ...d, status: 'failed', speed: 0 } : d
            ));
            addToast(`Download failed: ${movie.title}`, "error");
        }
      } finally {
          activeDownloadsRef.current.delete(movie.id);
      }
  };

  const pauseDownload = (movieId: string) => {
      const controller = activeDownloadsRef.current.get(movieId);
      if (controller) {
          controller.abort();
          activeDownloadsRef.current.delete(movieId);
      }
      setDownloads(prev => prev.map(d => d.movieId === movieId ? { ...d, status: 'paused', speed: 0 } : d));
      addToast("Download Paused", "info");
  };

  const deleteDownload = async (movieId: string, removeMetadata = true) => {
      // Abort if running
      const controller = activeDownloadsRef.current.get(movieId);
      if (controller) {
          controller.abort();
          activeDownloadsRef.current.delete(movieId);
      }
      
      // Remove from DB
      try {
          await deleteVideo(movieId);
          await updateStorageEstimate();
      } catch (e) {
          console.warn("Could not delete from DB", e);
      }

      if (removeMetadata) {
          setDownloads(prev => prev.filter(d => d.movieId !== movieId));
          addToast("Download Removed", "info");
      }
  };

  const handleExport = async (movie: Movie) => {
      const item = downloads.find(d => d.movieId === movie.id);
      if (!item || item.status !== 'completed') return;

      try {
          addToast("Preparing export...", "info");
          const blob = await getVideo(movie.id);
          if (blob) {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              // Clean filename for mobile compatibility
              const filename = `${movie.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              
              setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
              }, 100);
              
              addToast("Saved to Device Downloads", "success");
          } else {
              addToast("File not found in storage", "error");
          }
      } catch (e) {
          console.error("Export error", e);
          addToast("Failed to export", "error");
      }
  };

  const clearCompleted = async () => {
      const completed = downloads.filter(d => d.status === 'completed');
      for (const d of completed) {
          await deleteVideo(d.movieId);
      }
      await updateStorageEstimate();
      setDownloads(prev => prev.filter(d => d.status !== 'completed'));
      addToast(`Cleared ${completed.length} downloads`, "success");
  };

  const getDownloadStatus = (movieId: string) => {
      return downloads.find(d => d.movieId === movieId);
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    const results = await searchMoviesWithGemini(query, movies);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const loadRecommendations = async () => {
      const recs = await getGeminiRecommendations(watchHistory, movies);
      setRecommendations(recs);
  };
  
  // Load recommendations when Home mounts/updates history
  useEffect(() => {
    if (view === AppView.HOME && watchHistory.length > 0) {
        loadRecommendations();
    }
  }, [view, watchHistory]);

  const getStoragePercentage = () => {
      if (realStorage.quota === 0) return 0;
      return (realStorage.usage / realStorage.quota) * 100;
  };

  const getStorageDisplay = () => {
      const usageGB = (realStorage.usage / (1024 * 1024 * 1024)).toFixed(2);
      const quotaGB = (realStorage.quota / (1024 * 1024 * 1024)).toFixed(0);
      return `${usageGB}GB / ${quotaGB}GB used`;
  };

  if (view === AppView.PLAYER && activeMovie) {
    const saved = watchProgress.find(p => p.movieId === activeMovie.id);
    return (
      <VideoPlayer 
        movie={activeMovie} 
        initialTime={saved?.timestamp}
        videoSource={activeVideoSrc}
        onClose={handlePlayerClose} 
      />
    );
  }

  if (view === AppView.ADMIN) {
    return (
        <AdminPanel 
            onClose={() => setView(AppView.HOME)} 
            onAddMovie={(m) => setMovies([...movies, m])}
        />
    );
  }

  const HeroMovie = movies[0];
  const watchlistMovies = movies.filter(m => watchlist.includes(m.id));
  const continueWatchingMovies = watchProgress.map(p => {
      const m = movies.find(m => m.id === p.movieId);
      return m ? { ...m, progress: p } : null;
  }).filter(Boolean) as (Movie & { progress: WatchProgress })[];

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-background text-white font-sans transition-colors duration-300">
      {/* Toast Container */}
      <div className="fixed bottom-20 md:bottom-8 right-0 md:right-8 z-[60] flex flex-col gap-3 px-4 md:px-0">
          {toasts.map(t => (
              <Toast key={t.id} id={t.id} message={t.message} type={t.type} onClose={removeToast} />
          ))}
      </div>

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between transition-all duration-300 ${isMobileSearchOpen ? 'bg-background border-b border-gray-800' : 'bg-gradient-to-b from-black/90 to-transparent'}`}>
        {isMobileSearchOpen ? (
            <div className="flex w-full items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <button onClick={() => { setIsMobileSearchOpen(false); setSearchQuery(''); }}>
                    <ArrowLeft size={24} className="text-gray-300" />
                </button>
                <form 
                    onSubmit={(e) => { e.preventDefault(); performSearch(searchQuery); }} 
                    className="flex-1 relative"
                >
                    <input 
                        autoFocus
                        type="text"
                        className="w-full bg-gray-800 text-white rounded-full py-2 px-4 pl-10 focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </form>
            </div>
        ) : (
            <>
                <div className="flex items-center gap-8">
                    <h1 className="text-3xl font-bold text-primary cursor-pointer" onClick={() => setView(AppView.HOME)}>STREAM</h1>
                    <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
                        <button onClick={() => setView(AppView.HOME)} className={`hover:text-white transition ${view === AppView.HOME ? 'text-white' : ''}`}>Home</button>
                        <button onClick={() => setView(AppView.SEARCH)} className={`hover:text-white transition ${view === AppView.SEARCH ? 'text-white' : ''}`}>Search</button>
                        <button onClick={() => setView(AppView.DOWNLOADS)} className={`hover:text-white transition ${view === AppView.DOWNLOADS ? 'text-white' : ''}`}>My List</button>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Mobile Search Trigger */}
                    <button 
                        onClick={() => setIsMobileSearchOpen(true)} 
                        className="md:hidden p-2 hover:bg-white/10 rounded-full transition text-gray-300 hover:text-white"
                    >
                        <Search size={22} />
                    </button>

                    {/* Theme Switcher Mini */}
                    <div className="relative group hidden sm:block">
                        <button className="p-2 hover:bg-white/10 rounded-full transition"><Palette size={20} /></button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 hidden group-hover:block">
                            <div className="text-xs text-gray-400 mb-2 px-2">Select Theme</div>
                            {(['midnight', 'amoled', 'diwali', 'anime'] as Theme[]).map(t => (
                                <button 
                                    key={t} 
                                    onClick={() => setCurrentTheme(t)}
                                    className={`w-full text-left px-3 py-2 rounded text-sm capitalize hover:bg-white/10 ${currentTheme === t ? 'text-primary' : 'text-gray-300'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setView(AppView.ADMIN)} 
                        className="p-2 hover:bg-white/10 rounded-full transition text-gray-300 hover:text-white"
                        title="Admin Studio"
                    >
                        <Shield size={20} />
                    </button>
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center font-bold">U</div>
                </div>
            </>
        )}
      </nav>

      {/* Content Area */}
      <div className="w-full">
        {/* Mobile Search Overlay Results */}
        {isMobileSearchOpen && (
            <div className="fixed inset-0 top-[72px] z-30 bg-background overflow-y-auto px-6 pb-20 animate-in fade-in duration-300">
                {isSearching ? (
                     <div className="flex justify-center mt-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                     </div>
                ) : searchResults.length > 0 ? (
                    <div className="mt-6">
                        <h3 className="text-gray-400 mb-4 text-sm font-medium">Top Results</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {searchResults.map(movie => (
                                <div key={movie.id} className="cursor-pointer group" onClick={() => { setSelectedMovie(movie); setIsMobileSearchOpen(false); }}>
                                    <img src={movie.thumbnailUrl} className="w-full rounded-lg mb-2 transition group-hover:scale-105" />
                                    <h3 className="font-bold text-sm truncate">{movie.title}</h3>
                                    <p className="text-xs text-gray-500">{movie.year}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : searchQuery.length > 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                        <p>No results found for "{searchQuery}"</p>
                    </div>
                ) : (
                    <div className="mt-6">
                        <h3 className="text-gray-400 mb-4 text-sm font-medium">Recent Searches</h3>
                        <div className="flex flex-wrap gap-2">
                            {['Sci-Fi', 'Action 2024', 'Comedy'].map(term => (
                                <button key={term} onClick={() => { setSearchQuery(term); performSearch(term); }} className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                                    {term}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {view === AppView.HOME && !isMobileSearchOpen && (
          <>
            {/* Hero Section */}
            <div className="relative h-[80vh] w-full">
                <img src={HeroMovie.backdropUrl} className="w-full h-full object-cover" alt="Hero" />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
                
                <div className="absolute bottom-1/4 left-6 md:left-12 max-w-xl">
                    <h1 className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-lg">{HeroMovie.title}</h1>
                    <p className="text-lg md:text-xl text-gray-200 mb-6 drop-shadow-md line-clamp-3">{HeroMovie.description}</p>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => handlePlay(HeroMovie)}
                            className="bg-white text-black px-8 py-3 rounded flex items-center gap-2 font-bold hover:bg-gray-200 transition"
                        >
                            <Play fill="black" size={24} /> Play
                        </button>
                        <button className="bg-gray-500/50 backdrop-blur-md text-white px-8 py-3 rounded flex items-center gap-2 font-bold hover:bg-gray-500/70 transition">
                            <Info size={24} /> More Info
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Recommendations Row */}
            {recommendations.length > 0 && (
                <div className="px-6 md:px-12 -mt-24 relative z-10 mb-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary">
                        Spark AI Picks for You <span className="text-xs bg-primary/20 px-2 py-0.5 rounded text-primary border border-primary/50">BETA</span>
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {recommendations.map(movie => (
                            <div key={movie.id} className="group relative cursor-pointer" onClick={() => setSelectedMovie(movie)}>
                                <img src={movie.thumbnailUrl} className="w-full rounded-md transition duration-300 group-hover:scale-105 group-hover:z-20 relative" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="space-y-12 px-6 md:px-12 pb-20">
                {/* Continue Watching Section */}
                {continueWatchingMovies.length > 0 && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-bold mb-4 text-gray-100 flex items-center gap-2">
                           <Clock className="text-primary" size={20} /> Continue Watching
                        </h2>
                        <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar scroll-smooth">
                             {continueWatchingMovies.map((movie) => {
                                 const percent = (movie.progress.timestamp / movie.progress.totalDuration) * 100;
                                 return (
                                 <div 
                                    key={movie.id} 
                                    className="flex-none w-[200px] md:w-[260px] relative group cursor-pointer"
                                    onClick={() => handlePlay(movie)}
                                 >
                                    <div className="relative">
                                        <img src={movie.backdropUrl} className="w-full h-[112px] md:h-[146px] object-cover rounded-t-md group-hover:brightness-75 transition" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                            <div className="bg-black/60 rounded-full p-2 border border-white/30">
                                                <Play fill="white" size={20} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-800 rounded-b-md p-3 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-600">
                                            <div className="h-full bg-primary" style={{ width: `${percent}%` }}></div>
                                        </div>
                                        <h3 className="font-bold text-sm truncate text-gray-200">{movie.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{Math.floor(movie.duration - (movie.progress.timestamp / 60))}m remaining</p>
                                    </div>
                                 </div>
                             )})}
                        </div>
                    </div>
                )}
                
                 {/* My List Section */}
                 {watchlistMovies.length > 0 && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-bold mb-4 text-gray-100 flex items-center gap-2">
                           <List className="text-primary" size={20} /> My List
                        </h2>
                         <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar scroll-smooth">
                             {watchlistMovies.map((movie) => (
                                 <div 
                                    key={movie.id} 
                                    className="flex-none w-[160px] md:w-[220px] relative group cursor-pointer"
                                    onClick={() => setSelectedMovie(movie)}
                                 >
                                    <img src={movie.thumbnailUrl} className="w-full h-[240px] md:h-[330px] object-cover rounded-md group-hover:brightness-75 transition" />
                                 </div>
                             ))}
                        </div>
                    </div>
                 )}

                {CATEGORIES.map(cat => (
                    <div key={cat.id}>
                        <h2 className="text-xl font-bold mb-4 text-gray-100 hover:text-white cursor-pointer flex items-center gap-2 group">
                            {cat.title} <ChevronRight className="opacity-0 group-hover:opacity-100 transition duration-300 text-primary" size={20} />
                        </h2>
                        <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar scroll-smooth">
                             {movies.map((movie, idx) => (
                                 <div 
                                    key={movie.id} 
                                    className="flex-none w-[160px] md:w-[220px] relative group cursor-pointer"
                                    onClick={() => setSelectedMovie(movie)}
                                 >
                                    <img src={movie.thumbnailUrl} className="w-full h-[240px] md:h-[330px] object-cover rounded-md group-hover:brightness-75 transition" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                        <div className="bg-primary/90 rounded-full p-3 shadow-lg transform scale-0 group-hover:scale-100 transition duration-300">
                                            <Play fill="white" size={24} />
                                        </div>
                                    </div>
                                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition duration-300">
                                        <h3 className="font-bold text-sm truncate">{movie.title}</h3>
                                        <p className="text-xs text-gray-400">{movie.year} • {movie.genre[0]}</p>
                                    </div>
                                 </div>
                             ))}
                        </div>
                    </div>
                ))}
            </div>
          </>
        )}

        {view === AppView.SEARCH && !isMobileSearchOpen && (
            <div className="pt-24 px-6 md:px-12 min-h-screen">
                <form onSubmit={handleSearchSubmit} className="mb-12 max-w-3xl mx-auto relative">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for movies, genres, actors..." 
                        className="w-full bg-[#1f1f1f] border border-gray-700 text-white text-xl px-6 py-4 rounded-full focus:ring-2 focus:ring-primary outline-none pl-14"
                    />
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                    <button type="submit" disabled={isSearching} className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary px-6 py-2 rounded-full font-bold hover:bg-red-700 transition disabled:opacity-50">
                        {isSearching ? 'Thinking...' : 'Search'}
                    </button>
                </form>

                {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {searchResults.map(movie => (
                             <div key={movie.id} className="cursor-pointer group" onClick={() => setSelectedMovie(movie)}>
                                <img src={movie.thumbnailUrl} className="w-full rounded-lg mb-2 transition group-hover:scale-105" />
                                <h3 className="font-bold">{movie.title}</h3>
                             </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 mt-20">
                        <Film className="mx-auto mb-4 opacity-20" size={64} />
                        <p>Search for something to watch.</p>
                        <p className="text-sm mt-2 opacity-50">Try "Sci-fi movies about space" or "Action comedies"</p>
                    </div>
                )}
            </div>
        )}

        {view === AppView.DOWNLOADS && !isMobileSearchOpen && (
            <div className="pt-24 px-6 md:px-12 min-h-screen pb-20">
                <div className="max-w-5xl mx-auto">
                    {/* Header with improved layout */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3 mb-2 text-white">
                                <Download className="text-primary" size={32} /> Downloads
                            </h1>
                            <p className="text-gray-400 text-sm">Watch your favorites offline, anywhere.</p>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {/* Improved Storage Widget */}
                            <div className="bg-[#1a1a1a] border border-white/10 p-4 rounded-xl flex items-center gap-4 min-w-[280px] shadow-lg">
                                <div className="p-3 bg-gray-800 rounded-full">
                                    <HardDrive size={20} className="text-gray-300" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                                        <span>Device Storage</span>
                                        <span className="text-gray-400">{getStorageDisplay()}</span>
                                    </div>
                                    <div className="w-full bg-gray-700/30 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-primary to-primary/60 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(229,9,20,0.5)]" 
                                            style={{width: `${getStoragePercentage()}%`}}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                            {downloads.some(d => d.status === 'completed') && (
                                <button onClick={clearCompleted} className="text-xs text-gray-400 hover:text-white self-end flex items-center gap-1">
                                    <Trash2 size={12} /> Clear all completed
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {downloads.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-800 rounded-3xl bg-white/5">
                            <div className="bg-gray-800/50 p-6 rounded-full mb-6 ring-1 ring-white/10">
                                <Download className="text-gray-500" size={48} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Your library is empty</h3>
                            <p className="text-gray-500 max-w-sm text-center mb-8">Movies and series you download will appear here.</p>
                            <button 
                                onClick={() => setView(AppView.HOME)} 
                                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition flex items-center gap-2 transform hover:scale-105 duration-200"
                            >
                                <Search size={18} /> Find Movies
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {downloads.map((item, idx) => {
                                const movie = movies.find(m => m.id === item.movieId);
                                if (!movie) return null;
                                const isPaused = item.status === 'paused';
                                const isCompleted = item.status === 'completed';
                                const isFailed = item.status === 'failed';
                                const isQueued = item.status === 'queued';
                                
                                let statusColor = 'bg-primary';
                                let statusText = 'DOWNLOADING';
                                if (isPaused) { statusColor = 'bg-yellow-500'; statusText = 'PAUSED'; }
                                else if (isFailed) { statusColor = 'bg-red-500'; statusText = 'FAILED'; }
                                else if (isQueued) { statusColor = 'bg-blue-500'; statusText = 'QUEUED'; }

                                return (
                                    <div key={idx} className="bg-[#181818] border border-white/5 p-4 rounded-xl hover:border-white/10 hover:bg-[#202020] transition-all duration-300 group shadow-lg">
                                        <div className="flex gap-4 sm:gap-6">
                                            {/* Thumbnail with overlay status */}
                                            <div className="relative w-32 sm:w-48 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 shadow-inner">
                                                <img src={movie.backdropUrl} className={`w-full h-full object-cover transition duration-500 ${isCompleted ? 'group-hover:scale-110' : 'opacity-60 grayscale-[30%]'}`} />
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition" />
                                                
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    {isCompleted ? (
                                                        <div className="bg-black/40 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition duration-300 transform scale-75 group-hover:scale-100">
                                                            <Play fill="white" className="text-white" size={24} />
                                                        </div>
                                                    ) : isQueued ? (
                                                        <Hourglass className="text-blue-400 drop-shadow-xl animate-pulse" size={32} />
                                                    ) : isPaused && (
                                                        <Pause fill="white" className="text-white drop-shadow-xl" size={32} />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info & Desktop Actions */}
                                            <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                                                <div>
                                                    <div className="flex justify-between items-start gap-4">
                                                        <h3 className="font-bold text-lg text-white group-hover:text-primary transition truncate">{movie.title}</h3>
                                                        
                                                        {/* Desktop Button Group */}
                                                        <div className="hidden sm:flex items-center gap-2">
                                                            {isCompleted ? (
                                                                <>
                                                                    <button onClick={() => handlePlay(movie)} className="p-2.5 bg-white text-black rounded-full hover:bg-gray-200 transition shadow-lg hover:shadow-xl active:scale-95" title="Play Movie">
                                                                        <Play size={18} fill="black" />
                                                                    </button>
                                                                    <button onClick={() => handleExport(movie)} className="p-2.5 bg-gray-800 text-gray-400 rounded-full hover:bg-blue-900/40 hover:text-blue-400 transition" title="Save to Device">
                                                                        <FileDown size={18} />
                                                                    </button>
                                                                </>
                                                            ) : isQueued ? (
                                                                <button onClick={() => deleteDownload(movie.id)} className="p-2.5 bg-gray-800 text-gray-400 rounded-full hover:bg-red-900/40 hover:text-red-400 transition" title="Cancel Queue">
                                                                    <X size={18} />
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => isPaused ? requestDownload(movie) : pauseDownload(movie.id)} className={`p-2.5 rounded-full text-white transition shadow-lg hover:shadow-xl active:scale-95 ${isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}`} title={isPaused ? "Resume Download" : "Pause Download"}>
                                                                    {isPaused ? <Play size={18} fill="white" /> : <Pause size={18} fill="white" />}
                                                                </button>
                                                            )}
                                                            {!isQueued && (
                                                                <button onClick={() => deleteDownload(movie.id)} className="p-2.5 bg-gray-800 text-gray-400 rounded-full hover:bg-red-900/40 hover:text-red-400 transition" title="Remove Download">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-400 flex items-center gap-3 mb-3">
                                                        <span className="font-medium">{movie.year}</span>
                                                        <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                        <span>{movie.duration} min</span>
                                                        <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                        <span className="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded border border-white/10">HD</span>
                                                    </div>
                                                </div>

                                                {/* Progress Bar / Status */}
                                                <div className="w-full">
                                                    {!isCompleted ? (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-xs font-semibold tracking-wide">
                                                                <span className={isPaused ? 'text-yellow-500' : isFailed ? 'text-red-500' : isQueued ? 'text-blue-500' : 'text-primary'}>
                                                                    {statusText}
                                                                </span>
                                                                <span className="text-gray-400 font-mono">
                                                                    {isQueued ? 'WAITING' : `${Math.round(item.progress)}%`}
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full ring-1 ring-white/5">
                                                                <div 
                                                                    className={`h-full rounded-full transition-all duration-300 ${statusColor} ${!isPaused && !isFailed && !isQueued && 'animate-pulse'} ${isQueued && 'opacity-50'}`} 
                                                                    style={{ width: isQueued ? '100%' : `${item.progress}%` }}
                                                                ></div>
                                                            </div>
                                                            {!isQueued && (
                                                                <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1">
                                                                    <span className="font-mono">
                                                                        {(item.downloadedSizeMB).toFixed(1)} / {(item.totalSizeMB || 0).toFixed(1)} MB
                                                                    </span>
                                                                    {!isPaused && !isFailed && (
                                                                        <div className="flex items-center gap-1 text-primary/80">
                                                                            <Wifi size={12} />
                                                                            {item.speed?.toFixed(1)} MB/s
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 text-green-500 text-sm font-bold bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                                                                <Check size={14} strokeWidth={3} /> Complete
                                                            </div>
                                                            <span className="text-xs text-gray-500 font-mono">{(item.totalSizeMB / 1024).toFixed(2)} GB</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Controls (Footer) */}
                                        <div className="sm:hidden mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                                            {isCompleted ? (
                                                <>
                                                    <button onClick={() => handlePlay(movie)} className="flex-1 py-2 bg-white text-black font-bold rounded-lg text-sm flex items-center justify-center gap-2 active:bg-gray-200">
                                                        <Play size={16} fill="black" /> Watch Now
                                                    </button>
                                                    <button onClick={() => handleExport(movie)} className="p-2 text-gray-400 bg-gray-800 rounded-lg border border-gray-700 active:bg-gray-700">
                                                        <FileDown size={18} />
                                                    </button>
                                                </>
                                            ) : isQueued ? (
                                                <button onClick={() => deleteDownload(movie.id)} className="flex-1 py-2 bg-gray-800 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
                                                    <X size={16} /> Cancel
                                                </button>
                                            ) : (
                                                <button onClick={() => isPaused ? requestDownload(movie) : pauseDownload(movie.id)} className={`flex-1 py-2 font-bold rounded-lg text-sm flex items-center justify-center gap-2 text-white ${isPaused ? 'bg-green-600' : 'bg-yellow-600'}`}>
                                                    {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} fill="white" />}
                                                    {isPaused ? "Resume" : "Pause"}
                                                </button>
                                            )}
                                            {!isQueued && (
                                                <button onClick={() => deleteDownload(movie.id)} className="p-2 text-gray-400 bg-gray-800 rounded-lg border border-gray-700 active:bg-gray-700">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Movie Details Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedMovie(null)}></div>
            <div className="relative bg-[#181818] w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl animate-fade-in">
                <button onClick={() => setSelectedMovie(null)} className="absolute top-4 right-4 z-10 bg-black/50 p-2 rounded-full hover:bg-white/20 transition">
                    <X className="text-white" size={24} />
                </button>
                
                <div className="relative h-[400px]">
                    <img src={selectedMovie.backdropUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent"></div>
                    <div className="absolute bottom-8 left-8">
                        <h2 className="text-4xl font-bold mb-4">{selectedMovie.title}</h2>
                        <div className="flex items-center gap-4">
                            <button onClick={() => { handlePlay(selectedMovie); setSelectedMovie(null); }} className="bg-white text-black px-8 py-2 rounded font-bold flex items-center gap-2 hover:bg-gray-200">
                                <Play fill="black" size={20} /> Play
                            </button>
                            
                            {/* Smart Download Button */}
                            {(() => {
                                const status = getDownloadStatus(selectedMovie.id);
                                if (status?.status === 'completed') {
                                    return (
                                         <button onClick={() => setView(AppView.DOWNLOADS)} className="bg-green-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-green-700">
                                            <Download size={20} /> Downloaded
                                        </button>
                                    )
                                } else if (status) {
                                     return (
                                         <button onClick={() => setView(AppView.DOWNLOADS)} className="bg-gray-600/50 text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-gray-600/70 border border-primary/50">
                                            {status.status === 'queued' ? <Hourglass size={20} className="animate-spin" /> : <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>} 
                                            {status.status === 'paused' ? 'Paused' : status.status === 'queued' ? 'Queued' : 'Downloading...'}
                                        </button>
                                    )
                                } else {
                                    return (
                                        <button onClick={() => requestDownload(selectedMovie)} className="bg-gray-600/50 text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-gray-600/70">
                                            <Download size={20} /> Download
                                        </button>
                                    )
                                }
                            })()}

                            <button 
                                onClick={() => toggleWatchlist(selectedMovie.id)}
                                className={`p-2 border rounded-full transition ${watchlist.includes(selectedMovie.id) ? 'bg-white text-black border-white hover:bg-gray-200' : 'border-gray-400 hover:border-white text-white'}`}
                            >
                                {watchlist.includes(selectedMovie.id) ? <Check size={20} /> : <Plus size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                            <span className="text-green-500 font-bold">{selectedMovie.rating * 20}% Match</span>
                            <span>{selectedMovie.year}</span>
                            <span className="border border-gray-600 px-1 text-xs">HD</span>
                            <span>{selectedMovie.duration}m</span>
                        </div>
                        <p className="text-gray-300 leading-relaxed mb-6">{selectedMovie.description}</p>
                    </div>
                    <div className="text-sm space-y-4">
                        <div>
                            <span className="text-gray-500 block mb-1">Cast:</span>
                            <span className="text-gray-300">{selectedMovie.cast.join(", ") || "Ensemble Cast"}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block mb-1">Genres:</span>
                            <span className="text-gray-300">{selectedMovie.genre.join(", ")}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 border-t border-gray-800 flex justify-around p-4 z-50">
        <button onClick={() => setView(AppView.HOME)} className={`flex flex-col items-center gap-1 ${view === AppView.HOME ? 'text-primary' : 'text-gray-500'}`}>
            <Home size={20} />
            <span className="text-xs">Home</span>
        </button>
        <button onClick={() => setView(AppView.SEARCH)} className={`flex flex-col items-center gap-1 ${view === AppView.SEARCH ? 'text-primary' : 'text-gray-500'}`}>
            <Search size={20} />
            <span className="text-xs">Search</span>
        </button>
        <button onClick={() => setView(AppView.DOWNLOADS)} className={`flex flex-col items-center gap-1 ${view === AppView.DOWNLOADS ? 'text-primary' : 'text-gray-500'}`}>
            <Download size={20} />
            <span className="text-xs">Downloads</span>
        </button>
         <button onClick={() => setView(AppView.ADMIN)} className={`flex flex-col items-center gap-1 ${view === AppView.ADMIN ? 'text-primary' : 'text-gray-500'}`}>
            <User size={20} />
            <span className="text-xs">Account</span>
        </button>
      </div>
    </div>
  );
}

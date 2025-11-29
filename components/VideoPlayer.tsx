import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, Pause, Maximize, Minimize, Volume2, VolumeX, 
  SkipForward, ArrowLeft, Settings, FastForward, Rewind,
  Lock, Unlock, RotateCcw, MonitorPlay, Smartphone, Loader2, ChevronRight 
} from 'lucide-react';
import { Movie } from '../types';

interface VideoPlayerProps {
  movie: Movie;
  initialTime?: number;
  videoSource?: string;
  onClose: (progress?: number, duration?: number) => void;
  onNextEpisode?: () => void;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds().toString().padStart(2, "0");
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`;
  }
  return `${mm}:${ss}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, initialTime = 0, videoSource, onClose, onNextEpisode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  // Double Tap State
  const [doubleTapAction, setDoubleTapAction] = useState<'forward' | 'rewind' | null>(null);
  const doubleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parental Lock State
  const [isLocked, setIsLocked] = useState(movie.isMature || false);
  const [pin, setPin] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [correctPin, setCorrectPin] = useState('1234');
  
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load custom PIN from storage
  useEffect(() => {
    const storedPin = localStorage.getItem('parental_pin');
    if (storedPin) {
        setCorrectPin(storedPin);
    }
  }, []);

  useEffect(() => {
    // Set initial time if provided
    if (videoRef.current && initialTime > 0) {
        videoRef.current.currentTime = initialTime;
    }
  }, [initialTime]);

  useEffect(() => {
    // Auto-play if not locked
    if (!isLocked && videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.warn("Autoplay prevented:", e));
    }
  }, [isLocked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;
      
      switch(e.key) {
          case 'Escape':
             if (document.fullscreenElement) {
                 document.exitFullscreen();
                 setIsFullscreen(false);
             } else {
                 handleClose();
             }
             break;
          case ' ':
          case 'k':
             e.preventDefault();
             togglePlay();
             break;
          case 'ArrowRight':
             skipSeconds(10);
             break;
          case 'ArrowLeft':
             skipSeconds(-10);
             break;
          case 'f':
             toggleFullscreen();
             break;
          case 'm':
             toggleMute();
             break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isPlaying, currentTime]);

  const handleClose = () => {
      if (videoRef.current) {
          onClose(videoRef.current.currentTime, videoRef.current.duration);
      } else {
          onClose();
      }
  };

  // --- Parental Lock Logic ---
  const handlePinInput = (num: string) => {
    if (isUnlocking) return;
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const verifyPin = (inputPin: string) => {
    if (inputPin === correctPin) {
        // Success - Start Animation
        setIsUnlocking(true);
        setUnlockError(false);
        setTimeout(() => {
            setIsLocked(false);
            setIsUnlocking(false);
        }, 1000); // 1s animation duration
    } else {
        // Error
        setUnlockError(true);
        setTimeout(() => {
            setPin('');
            setUnlockError(false);
        }, 800);
    }
  };

  // --- Player Logic ---
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const vidDuration = videoRef.current.duration || 1;
      
      setCurrentTime(current);
      setDuration(vidDuration);
      setProgress((current / vidDuration) * 100);

      // Update Buffer
      if (videoRef.current.buffered.length > 0) {
          const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
          setBuffered((bufferedEnd / vidDuration) * 100);
      }

      // Show Skip Intro between 0s and 30s
      if (current > 0 && current < 30) {
          setShowSkipIntro(true);
      } else {
          setShowSkipIntro(false);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * videoRef.current.duration;
    
    videoRef.current.currentTime = newTime;
    setProgress(pos * 100);
  };

  const handleMouseMoveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || !videoRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      setHoverPosition(pos * 100);
      setHoverTime(pos * videoRef.current.duration);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleRotation = async () => {
    try {
        if (!document.fullscreenElement && containerRef.current) {
             await containerRef.current.requestFullscreen();
        }
        
        // @ts-ignore - Screen Orientation API
        if (window.screen.orientation && window.screen.orientation.lock) {
            const type = window.screen.orientation.type;
            if (type.startsWith('portrait')) {
                // @ts-ignore
                await window.screen.orientation.lock('landscape');
            } else {
                // @ts-ignore
                await window.screen.orientation.unlock();
            }
        }
    } catch (err) {
        console.log('Rotation failed or not supported', err);
    }
  };

  const togglePiP = async () => {
      try {
          if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
          } else if (videoRef.current && videoRef.current.requestPictureInPicture) {
              await videoRef.current.requestPictureInPicture();
          }
      } catch (err) {
          console.error("PiP Error", err);
      }
  };

  const skipSeconds = (seconds: number) => {
      if(videoRef.current) {
          videoRef.current.currentTime += seconds;
          // Trigger visual feedback
          setDoubleTapAction(seconds > 0 ? 'forward' : 'rewind');
          if (doubleTapTimeoutRef.current) clearTimeout(doubleTapTimeoutRef.current);
          doubleTapTimeoutRef.current = setTimeout(() => setDoubleTapAction(null), 600);
      }
  };

  const handleSkipIntro = () => {
      if (videoRef.current) {
          videoRef.current.currentTime = 35; // Skip to 35s
          setShowSkipIntro(false);
      }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // --- Render Locked View ---
  if (isLocked || isUnlocking) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden font-sans select-none text-white bg-black">
            {/* Background Image with Dynamic Zoom Effect */}
            <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out"
                style={{ 
                    backgroundImage: `url(${movie.backdropUrl})`,
                    transform: isUnlocking ? 'scale(1.25)' : `scale(${1.05 + (pin.length * 0.01)})`
                }}
            />
            <div className={`absolute inset-0 bg-black/80 backdrop-blur-2xl transition-opacity duration-1000 ${isUnlocking ? 'opacity-0' : 'opacity-100'}`} />

            {/* Enhanced Reactive Visualizer */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                {/* Core Energy Glow */}
                <div 
                    className="rounded-full blur-[80px] transition-all duration-300 ease-out"
                    style={{ 
                        width: isUnlocking ? '150vh' : `${300 + (pin.length * 100)}px`, 
                        height: isUnlocking ? '150vh' : `${300 + (pin.length * 100)}px`,
                        background: isUnlocking 
                            ? 'radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, transparent 70%)'
                            : unlockError 
                                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, transparent 70%)'
                                : `radial-gradient(circle, rgba(255, 255, 255, ${0.05 + (pin.length * 0.04)}) 0%, transparent 70%)`,
                        opacity: isUnlocking ? 1 : 0.8
                    }} 
                />
                
                {/* Orbiting Tech Ring */}
                <div 
                     className={`absolute rounded-full border border-white/5 transition-all duration-500 ease-out ${pin.length > 0 ? 'opacity-100' : 'opacity-0'}`}
                     style={{
                         width: `${380 + (pin.length * 120)}px`,
                         height: `${380 + (pin.length * 120)}px`,
                         transform: `rotate(${pin.length * 45}deg) scale(${1 + (pin.length * 0.02)})`,
                         borderWidth: '1px',
                         borderColor: unlockError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'
                     }}
                />
            </div>

            <div className={`relative z-10 flex flex-col items-center transition-all duration-700 transform ${isUnlocking ? 'scale-110 opacity-0 translate-y-4' : 'scale-100 opacity-100 translate-y-0'}`}>
                <div className={`mb-8 p-6 rounded-full bg-black/40 backdrop-blur-md border-2 transition-all duration-500 shadow-2xl ${isUnlocking ? 'border-green-500 bg-green-500/20 scale-110' : unlockError ? 'border-red-500 bg-red-500/20' : 'border-gray-600'}`}>
                    {isUnlocking ? (
                        <Unlock size={64} className="text-green-400 animate-pulse" />
                    ) : (
                        <Lock size={64} className={`text-white transition-colors duration-300 ${unlockError ? 'text-red-400' : ''}`} />
                    )}
                </div>
                <h2 className={`text-3xl font-bold mb-2 tracking-tight transition-colors duration-300 ${isUnlocking ? 'text-green-400' : 'text-white'}`}>
                    {isUnlocking ? 'Access Granted' : 'Restricted Content'}
                </h2>
                <p className="text-gray-400 mb-8 font-medium text-sm tracking-wide">
                    {isUnlocking ? 'Starting Playback...' : 'Please enter your security PIN to continue'}
                </p>
                <div className="flex gap-6 mb-10">
                    {[0, 1, 2, 3].map(i => (
                        <div 
                        key={i} 
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)]
                            ${unlockError ? 'border-red-500 bg-red-500 animate-bounce' 
                                : pin.length > i 
                                    ? isUnlocking ? 'border-green-500 bg-green-500 scale-110' : 'bg-white border-white shadow-[0_0_15px_rgba(255,255,255,0.8)]'
                                    : 'border-white/20 bg-transparent'
                            }`}
                        ></div>
                    ))}
                </div>
                <div className={`grid grid-cols-3 gap-6 mb-6 transition-all duration-300 ${isUnlocking ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button key={num} onClick={() => handlePinInput(num.toString())}
                        className="group relative w-20 h-20 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 active:bg-primary/20 active:border-primary flex items-center justify-center transition-all duration-200 ease-out">
                            <span className="text-3xl font-light text-white group-hover:text-white drop-shadow-md">{num}</span>
                        </button>
                    ))}
                    <div className="w-20 h-20"></div>
                    <div className="col-start-2">
                        <button onClick={() => handlePinInput("0")} className="group relative w-20 h-20 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 active:bg-primary/20 active:border-primary flex items-center justify-center transition-all duration-200 ease-out">
                            <span className="text-3xl font-light text-white group-hover:text-white drop-shadow-md">0</span>
                        </button>
                    </div>
                    <div className="col-start-3 flex items-center justify-center">
                        <button onClick={() => setPin(prev => prev.slice(0, -1))} className="group w-20 h-20 rounded-full bg-transparent border border-transparent hover:bg-white/5 hover:border-white/10 flex items-center justify-center transition-all duration-200 active:scale-95 active:bg-white/10">
                            <RotateCcw size={28} strokeWidth={1.5} className="text-gray-400 group-hover:text-white transition-colors" />
                        </button>
                    </div>
                </div>
                {unlockError && <div className="absolute bottom-10 w-full text-center"><p className="text-red-500 font-bold tracking-widest text-xs uppercase animate-pulse">Incorrect PIN Code</p></div>}
                <button onClick={handleClose} className="absolute top-10 right-10 p-4 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition duration-300">
                    <ArrowLeft size={32} />
                </button>
            </div>
      </div>
      );
  }

  // --- Render Active Player ---
  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center group overflow-hidden select-none font-sans"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={() => { if(showControls && isPlaying) setShowControls(false); else setShowControls(true); }}
    >
        <video 
            ref={videoRef}
            src={videoSource || movie.videoUrl} 
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onCanPlay={() => setIsBuffering(false)}
            onEnded={() => { setIsPlaying(false); setShowControls(true); }}
            autoPlay
            playsInline
        />

        {/* Double Tap Zones (Mobile) */}
        <div className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer" onDoubleClick={() => skipSeconds(-10)}></div>
        <div className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer" onDoubleClick={() => skipSeconds(10)}></div>

        {/* Double Tap Animation Overlay */}
        {doubleTapAction && (
             <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-30 pointer-events-none animate-in fade-in zoom-in duration-300 ${doubleTapAction === 'rewind' ? 'left-1/4' : 'right-1/4'}`}>
                 <div className="bg-black/60 rounded-full p-4 backdrop-blur-md mb-2">
                     {doubleTapAction === 'rewind' ? <Rewind fill="white" size={32} /> : <FastForward fill="white" size={32} />}
                 </div>
                 <span className="text-white font-bold text-shadow">{doubleTapAction === 'rewind' ? '-10s' : '+10s'}</span>
             </div>
        )}

        {/* Loading Spinner */}
        {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <Loader2 size={64} className="text-primary animate-spin drop-shadow-lg" />
            </div>
        )}

        {/* Top Gradient Overlay */}
        <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}></div>

        {/* Top Bar */}
        <div className={`absolute top-0 left-0 right-0 p-6 flex justify-between items-start transition-all duration-300 z-40 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
            <div className="flex items-center gap-4 cursor-pointer" onClick={handleClose}>
                <button className="p-2 hover:bg-white/20 rounded-full text-white transition">
                    <ArrowLeft size={28} />
                </button>
                <div>
                    <h2 className="text-white text-xl font-bold drop-shadow-md">{movie.title}</h2>
                    {videoSource ? (
                         <div className="flex items-center gap-2 text-green-400 text-xs font-medium bg-green-900/50 px-2 py-0.5 rounded border border-green-700/50">
                             <Lock size={10} /> Offline Mode
                         </div>
                    ) : (
                        <p className="text-gray-300 text-sm drop-shadow-md">S1:E1 "The Beginning"</p>
                    )}
                </div>
            </div>
            <div className="flex gap-4">
                 <button onClick={(e) => { e.stopPropagation(); togglePiP(); }} className="p-2 hover:bg-white/20 rounded-full text-white transition hidden md:block" title="PiP">
                    <MonitorPlay size={24} />
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); }} className="p-2 hover:bg-white/20 rounded-full text-white transition">
                    <Settings size={24} />
                 </button>
            </div>
        </div>

        {/* Skip Intro Button */}
        <div className={`absolute bottom-32 right-6 z-40 transition-all duration-500 ${showSkipIntro && showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
            <button 
                onClick={(e) => { e.stopPropagation(); handleSkipIntro(); }}
                className="bg-white/90 text-black px-6 py-2 rounded-md font-bold hover:bg-white transition shadow-lg flex items-center gap-2 backdrop-blur-sm"
            >
                Skip Intro <SkipForward size={16} fill="black" />
            </button>
        </div>

        {/* Center Play/Pause (Big Icon) */}
        {!isPlaying && showControls && !isBuffering && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                 <div className="bg-black/40 p-6 rounded-full backdrop-blur-sm border border-white/10 shadow-2xl">
                    <Play fill="white" size={48} className="text-white ml-2" />
                 </div>
             </div>
        )}

        {/* Bottom Controls Container */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-20 pb-6 px-6 transition-all duration-300 z-40 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`} onClick={e => e.stopPropagation()}>
            
            {/* Timeline Scrubber */}
            <div 
                ref={progressBarRef}
                className="group/slider relative w-full h-2 bg-gray-600/50 rounded-full cursor-pointer mb-6 hover:h-4 transition-all duration-200 flex items-center" 
                onClick={handleSeek}
                onMouseMove={handleMouseMoveProgress}
                onMouseLeave={() => { setHoverPosition(null); setHoverTime(null); }}
            >
                 {/* Hover Preview Time */}
                 {hoverPosition !== null && (
                    <div 
                        className="absolute bottom-full mb-3 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded border border-gray-700 pointer-events-none"
                        style={{ left: `${hoverPosition}%` }}
                    >
                        {formatTime(hoverTime || 0)}
                    </div>
                )}
                
                {/* Buffered Bar */}
                <div className="absolute top-0 left-0 h-full bg-gray-400/30 rounded-full pointer-events-none" style={{width: `${buffered}%`}}></div>
                
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none flex items-center" style={{width: `${progress}%`}}>
                    <div className="absolute right-0 w-3 h-3 bg-white rounded-full shadow scale-0 group-hover/slider:scale-125 transition-transform origin-center"></div>
                </div>

                 {/* Hover Ghost Bar */}
                 {hoverPosition !== null && (
                    <div className="absolute top-0 left-0 h-full bg-white/20 pointer-events-none" style={{width: `${hoverPosition}%`}}></div>
                )}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
                
                {/* Left Side: Playback & Volume */}
                <div className="flex items-center gap-6">
                    <button onClick={togglePlay} className="text-white hover:text-primary transition hover:scale-110 active:scale-95">
                        {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" />}
                    </button>
                    
                    <button onClick={() => skipSeconds(-10)} className="text-gray-300 hover:text-white transition hidden md:block hover:rotate-[-10deg]">
                        <RotateCcw size={24} />
                    </button>
                    <button onClick={() => skipSeconds(10)} className="text-gray-300 hover:text-white transition hidden md:block hover:rotate-[10deg]">
                        <FastForward size={24} />
                    </button>

                    {/* Volume Slider */}
                    <div className="flex items-center gap-2 group/vol">
                        <button onClick={toggleMute} className="text-gray-300 hover:text-white">
                            {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 flex items-center">
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.1"
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setVolume(val);
                                    if(videoRef.current) videoRef.current.volume = val;
                                    setIsMuted(val === 0);
                                }}
                                className="w-24 h-1 bg-gray-500 rounded-lg appearance-none cursor-pointer accent-white"
                            />
                        </div>
                    </div>

                    <div className="text-sm font-medium text-gray-300 select-none hidden sm:block">
                        <span className="text-white">{formatTime(currentTime)}</span>
                        <span className="mx-1 opacity-50">/</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right Side: Settings & Screen */}
                <div className="flex items-center gap-4">
                    {onNextEpisode && (
                        <button onClick={onNextEpisode} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition text-white border border-white/5">
                            <span className="hidden md:inline">Next Episode</span> <ChevronRight size={16} />
                        </button>
                    )}
                    
                    <button 
                        onClick={() => {
                            const speeds = [0.5, 1, 1.25, 1.5, 2];
                            const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                            setPlaybackSpeed(speeds[nextIdx]);
                            if (videoRef.current) videoRef.current.playbackRate = speeds[nextIdx];
                        }}
                        className="text-gray-300 hover:text-white font-bold text-sm hidden md:block w-12 text-center"
                    >
                        {playbackSpeed}x
                    </button>
                    
                    {/* Screen Rotation (Mobile) */}
                    <button onClick={toggleRotation} className="text-gray-300 hover:text-white transition md:hidden" title="Rotate Screen">
                        <Smartphone size={24} />
                    </button>

                    <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white transition hover:scale-110">
                        {isFullscreen ? <Minimize size={28} /> : <Maximize size={28} />}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default VideoPlayer;
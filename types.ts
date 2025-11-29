
export interface Movie {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  backdropUrl: string;
  videoUrl: string;
  duration: number; // in minutes
  year: number;
  genre: string[];
  rating: number;
  cast: string[];
  isSeries: boolean;
  seasons?: number;
  isMature?: boolean;
}

export interface WatchProgress {
  movieId: string;
  timestamp: number; // current time in seconds
  totalDuration: number;
  lastWatched: number; // Date.now()
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  watchlist: string[]; // movie IDs
  history: string[]; // movie IDs
  downloads: string[]; // movie IDs
}

export type Theme = 'midnight' | 'amoled' | 'diwali' | 'anime';

export enum AppView {
  AUTH = 'AUTH',
  HOME = 'HOME',
  PLAYER = 'PLAYER',
  ADMIN = 'ADMIN',
  DOWNLOADS = 'DOWNLOADS',
  SEARCH = 'SEARCH'
}

export interface DownloadItem {
  movieId: string;
  progress: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  expiry: number; // timestamp
  totalSizeMB: number;
  downloadedSizeMB: number;
  speed?: number; // MB/s (simulated for UI)
}

import React, { useState } from 'react';
import { Upload, Film, Users, BarChart3, Settings, Plus, X, Lock, Save, ShieldAlert } from 'lucide-react';
import { Movie } from '../types';

interface AdminPanelProps {
  onClose: () => void;
  onAddMovie: (movie: Movie) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onAddMovie }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'settings'>('dashboard');
  const [uploadForm, setUploadForm] = useState<Partial<Movie>>({
    title: '',
    description: '',
    genre: [],
    year: new Date().getFullYear(),
    isMature: false,
  });

  // Settings State
  const [pinForm, setPinForm] = useState({
      newPin: '',
      confirmPin: ''
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const newMovie: Movie = {
        id: `m${Date.now()}`,
        title: uploadForm.title || 'Untitled',
        description: uploadForm.description || '',
        thumbnailUrl: 'https://picsum.photos/300/450',
        backdropUrl: 'https://picsum.photos/1920/1080',
        videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        duration: 120,
        year: uploadForm.year || 2024,
        genre: uploadForm.genre || ['Action'],
        rating: 0,
        cast: [],
        isSeries: false,
        isMature: uploadForm.isMature || false,
    };
    onAddMovie(newMovie);
    alert("Movie uploaded successfully!");
    setUploadForm({ title: '', description: '', genre: [], isMature: false });
    setActiveTab('dashboard');
  };

  const handleSavePin = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!/^\d{4}$/.test(pinForm.newPin)) {
          alert("PIN must be exactly 4 digits.");
          return;
      }

      if (pinForm.newPin !== pinForm.confirmPin) {
          alert("PINs do not match.");
          return;
      }

      localStorage.setItem('parental_pin', pinForm.newPin);
      alert("Parental Control PIN updated successfully.");
      setPinForm({ newPin: '', confirmPin: '' });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-black border-r border-gray-800 p-6 flex flex-col">
        <h2 className="text-2xl font-bold text-primary mb-10">Admin Studio</h2>
        <nav className="space-y-4 flex-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <BarChart3 size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition ${activeTab === 'upload' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <Upload size={20} />
            Upload Content
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-lg text-gray-400 hover:bg-gray-800 transition">
            <Users size={20} />
            Users
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <Settings size={20} />
            Settings
          </button>
        </nav>
        <button onClick={onClose} className="mt-auto flex items-center gap-2 text-gray-400 hover:text-white">
            <X size={16} /> Exit Admin
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold">Dashboard Overview</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-gray-400 mb-2">Total Users</h3>
                <p className="text-4xl font-bold">12,450</p>
                <span className="text-green-500 text-sm">↑ 12% from last month</span>
              </div>
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-gray-400 mb-2">Active Streams</h3>
                <p className="text-4xl font-bold">843</p>
                <span className="text-green-500 text-sm">↑ 5% from yesterday</span>
              </div>
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-gray-400 mb-2">Revenue</h3>
                <p className="text-4xl font-bold">$45,200</p>
                <span className="text-green-500 text-sm">↑ 18% from last month</span>
              </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-64 flex items-center justify-center">
                <p className="text-gray-500">Analytics Graph Placeholder (Recharts)</p>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Upload New Content</h1>
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">Movie/Series Title</label>
                <input 
                    type="text" 
                    required
                    value={uploadForm.title}
                    onChange={e => setUploadForm({...uploadForm, title: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Enter title"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-400">Release Year</label>
                    <input 
                        type="number" 
                        value={uploadForm.year}
                        onChange={e => setUploadForm({...uploadForm, year: parseInt(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-400">Quality</label>
                    <select className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none">
                        <option>4K Ultra HD</option>
                        <option>1080p Full HD</option>
                        <option>720p HD</option>
                    </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">Description</label>
                <textarea 
                    rows={4}
                    value={uploadForm.description}
                    onChange={e => setUploadForm({...uploadForm, description: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Plot summary..."
                />
              </div>

               <div className="flex items-center space-x-3 bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <input 
                        type="checkbox" 
                        id="isMature"
                        checked={uploadForm.isMature || false}
                        onChange={e => setUploadForm({...uploadForm, isMature: e.target.checked})}
                        className="w-5 h-5 accent-primary rounded cursor-pointer"
                    />
                    <label htmlFor="isMature" className="flex items-center gap-2 cursor-pointer select-none">
                        <Lock size={16} className="text-red-500" />
                        <span className="font-medium text-white">Mature Content (Parental Lock)</span>
                    </label>
              </div>

              <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition cursor-pointer">
                <Upload size={48} className="mb-4" />
                <p className="font-medium">Drag & Drop Video File</p>
                <p className="text-sm mt-2 text-gray-500">MP4, MKV supported</p>
              </div>

              <button type="submit" className="w-full bg-primary hover:bg-red-700 text-white font-bold py-4 rounded-lg transition shadow-lg shadow-primary/20">
                Publish Content
              </button>
            </form>
          </div>
        )}

        {activeTab === 'settings' && (
             <div className="max-w-2xl mx-auto animate-fade-in">
                <h1 className="text-3xl font-bold mb-8">Platform Settings</h1>
                
                <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 mb-8">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-700">
                         <div className="p-3 bg-primary/20 rounded-full text-primary">
                             <Lock size={24} />
                         </div>
                         <div>
                             <h2 className="text-xl font-bold text-white">Parental Controls</h2>
                             <p className="text-sm text-gray-400">Manage access restrictions for mature content.</p>
                         </div>
                    </div>
                    
                    <form onSubmit={handleSavePin} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-400">New PIN (4 digits)</label>
                                <input 
                                    type="password"
                                    maxLength={4}
                                    pattern="\d{4}"
                                    value={pinForm.newPin}
                                    onChange={e => setPinForm({...pinForm, newPin: e.target.value.replace(/\D/g, '')})}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none tracking-widest font-mono text-center text-xl"
                                    placeholder="----"
                                />
                            </div>
                             <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-400">Confirm PIN</label>
                                <input 
                                    type="password" 
                                    maxLength={4}
                                    pattern="\d{4}"
                                    value={pinForm.confirmPin}
                                    onChange={e => setPinForm({...pinForm, confirmPin: e.target.value.replace(/\D/g, '')})}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none tracking-widest font-mono text-center text-xl"
                                    placeholder="----"
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <ShieldAlert className="text-yellow-500 flex-shrink-0" size={20} />
                            <p className="text-sm text-yellow-200/80">
                                This PIN will be required to access any content marked as "Mature". 
                                Default PIN is <strong>1234</strong>.
                            </p>
                        </div>

                        <button type="submit" className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-red-700 text-white font-bold py-3 rounded-lg transition">
                            <Save size={18} /> Update PIN
                        </button>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
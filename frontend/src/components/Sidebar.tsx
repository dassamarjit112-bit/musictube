import React from "react";
import { 
  Home, 
  Compass, 
  Library, 
  Plus,
  Play
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">
          <Play size={20} fill="currentColor" />
        </div>
        <span className="logo-text">YouTube Music</span>
      </div>
      
      <nav className="nav-links">
        <button 
          className={`nav-item ${activeTab === "home" ? "active" : ""}`}
          onClick={() => onTabChange("home")}
        >
          <Home size={24} />
          <span>Home</span>
        </button>
        <button 
          className={`nav-item ${activeTab === "explore" ? "active" : ""}`}
          onClick={() => onTabChange("explore")}
        >
          <Compass size={24} />
          <span>Explore</span>
        </button>
        <button 
          className={`nav-item ${activeTab === "library" ? "active" : ""}`}
          onClick={() => onTabChange("library")}
        >
          <Library size={24} />
          <span>Library</span>
        </button>
      </nav>

      <div className="sidebar-divider" />

      <button className="new-playlist-btn">
        <Plus size={20} />
        <span>New playlist</span>
      </button>

      {/* Mock playlists for aesthetic */}
      <div className="playlist-list">
        <div className="nav-item">Liked Music</div>
        <div className="nav-item">Your Episodes</div>
      </div>
    </aside>
  );
};

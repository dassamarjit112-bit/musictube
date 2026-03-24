import React from "react";
import { Search } from "lucide-react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

export const Header: React.FC<HeaderProps> = ({ searchQuery, onSearchChange, onSearchSubmit }) => {
  return (
    <header className="main-header yt-glass">
      <div className="search-container">
        <form onSubmit={onSearchSubmit}>
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search songs, albums, artists, podcasts"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </form>
      </div>
      <div className="user-profile">
        <div className="avatar">SD</div>
      </div>
    </header>
  );
};

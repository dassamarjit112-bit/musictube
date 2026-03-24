import React from "react";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Shuffle, 
  Volume2, 
  ThumbsUp,
  ThumbsDown,
  MoreVertical
} from "lucide-react";
import type { Song } from "../api";

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  played: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatTime: (seconds: number) => string;
}

export const PlayerBar: React.FC<PlayerProps> = ({ 
  currentSong, 
  isPlaying, 
  played, 
  duration, 
  volume,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  formatTime
}) => {
  return (
    <footer className="player-bar">
      <div className="player-track-info">
        {currentSong ? (
          <>
            <img src={currentSong.thumbnail} alt="track" className="player-thumb" />
            <div className="track-text">
              <h3>{currentSong.title}</h3>
              <p>{currentSong.artist} • {currentSong.duration}</p>
            </div>
            <div className="track-actions">
              <button><ThumbsUp size={16} /></button>
              <button><ThumbsDown size={16} /></button>
            </div>
          </>
        ) : (
          <div className="track-text-placeholder">No song playing</div>
        )}
      </div>

      <div className="player-controls">
        <div className="control-btns">
          <button><Shuffle size={18} /></button>
          <button onClick={onPrev}><SkipBack size={24} fill="currentColor" /></button>
          <button 
            className="play-pause-btn"
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
          </button>
          <button onClick={onNext}><SkipForward size={24} fill="currentColor" /></button>
          <button><Repeat size={18} /></button>
        </div>
        <div className="progress-container">
          <span>{formatTime(played * duration)}</span>
          <input 
            type="range" 
            className="progress-slider"
            min={0}
            max={0.999999}
            step="any"
            value={played}
            onChange={onSeek}
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-actions">
        <button><Volume2 size={24} /></button>
        <input 
          type="range" 
          className="volume-slider"
          min={0}
          max={1}
          step="any"
          value={volume}
          onChange={onVolumeChange}
        />
        <button><MoreVertical size={20} /></button>
      </div>
    </footer>
  );
};

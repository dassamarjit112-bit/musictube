import React, { useEffect, useState, useRef } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, ThumbsUp, ThumbsDown, MoreVertical, Search,
  Home, Compass, Library, PlusCircle, Tv, ArrowLeft, Music2
} from "lucide-react";
import { api } from "./api";
import type { Song, HomeSection, SearchResult, ArtistDetail, AlbumDetail } from "./api";
import { useYouTubePlayer } from "./useYouTubePlayer";
import "./App.css";

type View =
  | { name: "home" }
  | { name: "search" }
  | { name: "explore" }
  | { name: "library" }
  | { name: "artist"; id: string }
  | { name: "album"; id: string };

function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [homeData, setHomeData] = useState<HomeSection[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [played, setPlayed] = useState(0);       // 0–1 fraction
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [exploreData, setExploreData] = useState<{ title: string; items: any[] }[]>([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(false);
  const [artistData, setArtistData] = useState<ArtistDetail | null>(null);
  const [albumData, setAlbumData] = useState<AlbumDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const ytPlayer = useYouTubePlayer("yt-player-container", {
    onStateChange: (state) => {
      // YT.PlayerState: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
      if (state === 1) setIsPlaying(true);
      else if (state === 2) setIsPlaying(false);
    },
    onProgress: (p, secs) => {
      setPlayed(p);
      setPlayedSeconds(secs);
    },
    onDuration: (d) => setDuration(d),
    onEnded: () => handleNext(),
    onError: (code) => {
      console.error("YouTube player error code:", code);
      const msg =
        code === 150 || code === 101
          ? "This video is restricted from being embedded."
          : code === 5
          ? "HTML5 player error."
          : `Playback error (code ${code}). Trying next track…`;
      setPlayerError(msg);
      setTimeout(() => {
        setPlayerError(null);
        handleNext();
      }, 2500);
    },
  });

  // Volume sync
  useEffect(() => {
    ytPlayer.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted, ytPlayer]);

  // Play/pause sync
  useEffect(() => {
    if (!currentSong) return;
    if (isPlaying) ytPlayer.play();
    else ytPlayer.pause();
  }, [isPlaying, currentSong, ytPlayer]);

  // Load new song
  useEffect(() => {
    if (!currentSong?.videoId) return;
    setPlayerError(null);
    ytPlayer.load(currentSong.videoId);
    setIsPlaying(true);
  }, [currentSong?.videoId, ytPlayer]);

  // Media session
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: (currentSong as any).album || "",
      artwork: [{ src: currentSong.thumbnail, sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler("previoustrack", handlePrev);
    navigator.mediaSession.setActionHandler("nexttrack", handleNext);
  }, [currentSong]);

  // Fetch data on tab change
  useEffect(() => {
    if (!isLoggedIn) return;
    if (view.name === "home" && homeData.length === 0) fetchHome();
    if (view.name === "explore" && exploreData.length === 0) fetchExplore();
    if (view.name === "artist") fetchArtist((view as any).id);
    if (view.name === "album") fetchAlbum((view as any).id);
  }, [isLoggedIn, view.name, (view as any).id]);

  const fetchHome = async () => {
    try {
      const data = await api.home();
      setHomeData(data.sections);
    } catch (err) {
      console.error("Home fetch failed:", err);
    }
  };

  const fetchExplore = async () => {
    setIsLoadingExplore(true);
    try {
      const [moodsRes, newsRes] = await Promise.all([api.moods(), api.newReleases()]);
      setExploreData([{ title: "New Releases", items: newsRes.albums }, ...moodsRes.categories]);
    } catch (err) {
      console.error("Explore fetch failed", err);
    } finally {
      setIsLoadingExplore(false);
    }
  };

  const fetchArtist = async (id: string) => {
    setIsLoading(true);
    setArtistData(null);
    try {
      const data = await api.artist(id);
      setArtistData(data);
    } catch (err) {
      console.error("Artist fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAlbum = async (id: string) => {
    setIsLoading(true);
    setAlbumData(null);
    try {
      const data = await api.album(id);
      setAlbumData(data);
    } catch (err) {
      console.error("Album fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setView({ name: "search" });
    try {
      const res = await api.search(searchQuery);
      setSearchResults(res.results);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNext = () => {
    const song = currentSongRef.current;
    if (!song || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.videoId === song.videoId);
    if (idx < queue.length - 1) setCurrentSong(queue[idx + 1]);
    else setIsPlaying(false);
  };

  const handlePrev = () => {
    if (playedSeconds > 3) {
      // Restart current song
      ytPlayer.seekTo(0);
      return;
    }
    const song = currentSongRef.current;
    if (!song || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.videoId === song.videoId);
    if (idx > 0) setCurrentSong(queue[idx - 1]);
  };

  const playSong = (song: Song, songList?: Song[]) => {
    if (!song.videoId) return;
    console.log("▶ Playing:", song.title, "| videoId:", song.videoId);
    setCurrentSong(song);
    setPlayed(0);
    setPlayedSeconds(0);
    setDuration(0);
    if (songList && songList.length > 0) {
      setQueue(songList);
    } else if (!queue.find((s) => s.videoId === song.videoId)) {
      setQueue((q) => [...q, song]);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayed(val);
    ytPlayer.seekTo(val);
  };

  const formatTime = (s: number) => {
    if (!s || s < 0 || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sc = Math.floor(s % 60);
    return `${m}:${sc.toString().padStart(2, "0")}`;
  };

  const goBack = () => setView({ name: "home" });

  // ─── Login Screen ────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <Play size={40} fill="#f00" />
            <span>YouTube Music</span>
          </div>
          <h1>Sign in</h1>
          <p>to continue to YouTube Music</p>
          <form onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }}>
            <input type="email" placeholder="Email or phone" required />
            <div className="login-footer">
              <button type="button" className="create-account">Create account</button>
              <button type="submit" className="next-btn">Next</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── Main App ────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-section"><Play size={24} fill="#f00" /><span>Music</span></div>
        <nav>
          <button onClick={() => setView({ name: "home" })} className={view.name === "home" ? "active" : ""}>
            <Home size={24} /> <span>Home</span>
          </button>
          <button onClick={() => setView({ name: "explore" })} className={view.name === "explore" ? "active" : ""}>
            <Compass size={24} /> <span>Explore</span>
          </button>
          <button className={view.name === "library" ? "active" : ""}>
            <Library size={24} /> <span>Library</span>
          </button>
        </nav>
        <div className="playlist-btn"><PlusCircle size={20} /> New playlist</div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="queue-section">
            <p className="queue-title">Queue ({queue.length})</p>
            {queue.map((s, i) => (
              <div
                key={i}
                className={`queue-item ${currentSong?.videoId === s.videoId ? "active" : ""}`}
                onClick={() => playSong(s)}
              >
                <img src={s.thumbnail} alt="" />
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            {(view.name === "artist" || view.name === "album") && (
              <button className="back-btn" onClick={goBack}><ArrowLeft size={20} /></button>
            )}
            <div className="search-box">
              <Search size={20} />
              <form onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Search songs, albums, artists"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </div>
          </div>
          <div className="user-profile">
            <button className="cast-btn"><Tv size={20} /></button>
            <div className="avatar">SD</div>
          </div>
        </header>

        <section className="scroll-area">

          {/* ── HOME ── */}
          {view.name === "home" && (
            <div className="home-view">
              <div className="chips">
                {["Energize", "Relax", "Workout", "Commute", "Focus"].map((c) => (
                  <button key={c} className="chip">{c}</button>
                ))}
              </div>
              {homeData.length === 0 && <div className="loader" />}
              {homeData.map((s, i) => (
                <div key={i} className="section-container">
                  <h2>{s.title}</h2>
                  <div className="horizontal-scroll">
                    {s.items.map((item: any, j) => (
                      <div
                        key={j}
                        className="card"
                        onClick={() => {
                          if (item.type === "song" || item.type === "video") {
                            const songList = s.items.filter(
                              (x: any) => x.type === "song" || x.type === "video"
                            ) as Song[];
                            playSong(item as Song, songList);
                          } else if (item.type === "artist" && item.browseId) {
                            setView({ name: "artist", id: item.browseId } as any);
                          } else if (item.type === "album" && item.browseId) {
                            setView({ name: "album", id: item.browseId } as any);
                          }
                        }}
                      >
                        <div className="card-thumb">
                          <img src={item.thumbnail} alt="" />
                          {(item.type === "song" || item.type === "video") && (
                            <div className="play-overlay"><Play size={24} fill="#fff" /></div>
                          )}
                        </div>
                        <div className="card-info">
                          <h3>{item.title || item.name}</h3>
                          <p>{item.artist || item.subscribers || ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EXPLORE ── */}
          {view.name === "explore" && (
            <div className="explore-view">
              <h2>Explore</h2>
              {isLoadingExplore ? <div className="loader" /> : exploreData.map((s, i) => (
                <div key={i} className="section-container">
                  <h2>{s.title}</h2>
                  <div className="horizontal-scroll">
                    {s.items.map((item: any, j) => (
                      <div
                        key={j}
                        className="card"
                        onClick={() => {
                          if (item.type === "song" || item.type === "video") playSong(item as Song);
                          else if (item.type === "album" && item.browseId) setView({ name: "album", id: item.browseId } as any);
                          else if (item.type === "artist" && item.browseId) setView({ name: "artist", id: item.browseId } as any);
                        }}
                      >
                        <div className="card-thumb"><img src={item.thumbnail} alt="" /></div>
                        <div className="card-info">
                          <h3>{item.title || item.name}</h3>
                          <p>{item.artist || item.year || ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SEARCH ── */}
          {view.name === "search" && (
            <div className="search-view">
              <h2>Results for "{searchQuery}"</h2>
              {isSearching ? <div className="loader" /> : (
                <div className="search-list">
                  {searchResults.map((item: any, i) => (
                    <div
                      key={i}
                      className="search-row"
                      onClick={() => {
                        if (item.type === "song" || item.type === "video") {
                          const songList = searchResults.filter(
                            (x: any) => x.type === "song" || x.type === "video"
                          ) as Song[];
                          playSong(item as Song, songList);
                        } else if (item.type === "artist" && item.browseId) {
                          setView({ name: "artist", id: item.browseId } as any);
                        } else if (item.type === "album" && item.browseId) {
                          setView({ name: "album", id: item.browseId } as any);
                        }
                      }}
                    >
                      <img src={item.thumbnail} alt="" className="row-thumb" />
                      <div className="row-info">
                        <h3>{item.title || item.name}</h3>
                        <p className="row-type-badge">{item.type}</p>
                        <p>{item.artist || item.subscribers || ""}</p>
                      </div>
                      <div className="row-actions">
                        {(item.type === "song" || item.type === "video") && (
                          <><ThumbsUp size={18} /><ThumbsDown size={18} /></>
                        )}
                        <MoreVertical size={18} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ARTIST ── */}
          {view.name === "artist" && (
            <div className="detail-view">
              {isLoading && <div className="loader" />}
              {artistData && (
                <>
                  <div className="detail-hero" style={{ backgroundImage: `url(${artistData.thumbnail})` }}>
                    <div className="detail-hero-overlay">
                      <h1>{artistData.name}</h1>
                      <p>{artistData.subscribers}</p>
                      {artistData.description && <p className="desc">{artistData.description}</p>}
                    </div>
                  </div>
                  <div className="detail-body">
                    {artistData.songs.length > 0 && (
                      <div className="section-container">
                        <h2>Popular Songs</h2>
                        <div className="track-list">
                          {artistData.songs.map((song, i) => (
                            <div
                              key={i}
                              className={`track-row ${currentSong?.videoId === song.videoId ? "playing" : ""}`}
                              onClick={() => playSong(song, artistData.songs)}
                            >
                              <span className="track-num">
                                {currentSong?.videoId === song.videoId && isPlaying
                                  ? <Music2 size={14} className="eq-anim" />
                                  : i + 1}
                              </span>
                              <img src={song.thumbnail} alt="" />
                              <div className="track-info-col">
                                <h3>{song.title}</h3>
                                <p>{song.artist}</p>
                              </div>
                              <span className="track-dur">{song.duration}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {artistData.albums.length > 0 && (
                      <div className="section-container">
                        <h2>Albums</h2>
                        <div className="horizontal-scroll">
                          {artistData.albums.map((album, i) => (
                            <div key={i} className="card" onClick={() => album.browseId && setView({ name: "album", id: album.browseId } as any)}>
                              <div className="card-thumb"><img src={album.thumbnail} alt="" /></div>
                              <div className="card-info"><h3>{album.title}</h3><p>{album.year}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ALBUM ── */}
          {view.name === "album" && (
            <div className="detail-view">
              {isLoading && <div className="loader" />}
              {albumData && (
                <>
                  <div className="album-header">
                    <img src={albumData.thumbnail} alt="" className="album-cover" />
                    <div className="album-meta">
                      <p className="album-label">Album</p>
                      <h1>{albumData.title}</h1>
                      <p>{albumData.artist} • {albumData.year}</p>
                      <p>{albumData.trackCount} tracks • {albumData.duration}</p>
                      <button
                        className="play-all-btn"
                        onClick={() => albumData.tracks.length > 0 && playSong(albumData.tracks[0], albumData.tracks)}
                      >
                        <Play size={18} fill="#000" /> Play All
                      </button>
                    </div>
                  </div>
                  <div className="track-list">
                    {albumData.tracks.map((track, i) => (
                      <div
                        key={i}
                        className={`track-row ${currentSong?.videoId === track.videoId ? "playing" : ""}`}
                        onClick={() => playSong(track, albumData.tracks)}
                      >
                        <span className="track-num">
                          {currentSong?.videoId === track.videoId && isPlaying
                            ? <Music2 size={14} className="eq-anim" />
                            : i + 1}
                        </span>
                        <div className="track-info-col">
                          <h3>{track.title}</h3>
                          <p>{track.artist}</p>
                        </div>
                        <span className="track-dur">{track.duration}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </section>
      </main>

      {/* ── Player Bar ── */}
      <footer className="player-bar-v2">
        <div className="progress-bar-container">
          <input
            type="range" min={0} max={0.9999} step="any"
            value={played}
            onChange={handleSeek}
            className="progress-range"
          />
        </div>
        <div className="player-main">
          <div className="track-info">
            {currentSong ? (
              <>
                <img src={currentSong.thumbnail} alt="" className="thumb" />
                <div className="text">
                  <h3>{currentSong.title}</h3>
                  <p>{currentSong.artist} • {currentSong.duration}</p>
                </div>
              </>
            ) : <p className="no-song">No song playing</p>}
          </div>

          {playerError && (
            <div className="player-error">{playerError}</div>
          )}

          <div className="controls">
            <button onClick={handlePrev}><SkipBack size={24} fill="currentColor" /></button>
            <button
              className="play-btn"
              onClick={() => {
                if (!currentSong) return;
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            </button>
            <button onClick={handleNext}><SkipForward size={24} fill="currentColor" /></button>
          </div>

          <div className="actions">
            <div className="progress-labels">
              <span>{formatTime(playedSeconds)} / {formatTime(duration)}</span>
            </div>
            <button
              className="icon-btn"
              onClick={() => setIsMuted((m) => !m)}
              title={isMuted ? "Unmute" : "Mute"}
            >
              <Volume2 size={20} style={{ opacity: isMuted ? 0.4 : 1 }} />
            </button>
            <input
              type="range" min={0} max={1} step="any"
              value={isMuted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
              className="volume-range"
            />
            <Shuffle size={18} />
            <Repeat size={18} />
          </div>
        </div>
      </footer>

      {/* ── Hidden YouTube IFrame Container ── */}
      <div className="yt-engine">
        <div id="yt-player-container" />
      </div>
    </div>
  );
}

export default App;

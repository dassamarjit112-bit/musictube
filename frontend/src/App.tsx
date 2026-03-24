import React, { useEffect, useState, useRef } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, ThumbsUp, ThumbsDown, MoreVertical, Search,
  Home, Compass, Library, PlusCircle, Tv, ArrowLeft, Music2, Menu
} from "lucide-react";
import { api } from "./api";
import type { Song, HomeSection, SearchResult, ArtistDetail, AlbumDetail } from "./api";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { supabase } from "./lib/supabase";
import { Auth } from "./components/Auth";
import { motion, AnimatePresence } from "framer-motion";
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
  const [user, setUser] = useState<any>(null);
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
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [favorites, setFavorites] = useState<Song[]>([]); // list of full song objects
  const [history, setHistory] = useState<Song[]>([]);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const queueRef = useRef(queue);
  queueRef.current = queue;

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

  // Supabase Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
        fetchHistory(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
        fetchHistory(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync session loading
  const isLoggedIn = !!user;

  // Fetch data on tab change
  useEffect(() => {
    if (!isLoggedIn) return;
    if (view.name === "home" && homeData.length === 0) fetchHome();
    if (view.name === "explore" && exploreData.length === 0) fetchExplore();
    if (view.name === "artist") fetchArtist((view as any).id);
    if (view.name === "album") fetchAlbum((view as any).id);
  }, [isLoggedIn, view.name, (view as any).id]);

  // Autostart first song from home feed if none selected
  useEffect(() => {
    if (homeData.length > 0 && homeData[0].items.length > 0 && !currentSong) {
      const firstSection = homeData[0];
      const song = firstSection.items.find((i: any) => i.type === "song" || i.type === "video");
      if (song) {
        console.log("⚡ Autostarting first song...");
        setCurrentSong(song as Song);
        setQueue(firstSection.items.filter((i: any) => i.type === "song" || i.type === "video") as Song[]);
      }
    }
  }, [homeData, currentSong]);

  const fetchFavorites = async (userId: string) => {
    const { data } = await supabase.from('favorites').select('video_id:item_id, title, artist, thumbnail').eq('user_id', userId);
    if (data) setFavorites(data as any);
  };

  const fetchHistory = async (userId: string) => {
    const { data } = await supabase.from('history').select('*').eq('user_id', userId).order('played_at', { ascending: false }).limit(30);
    if (data) setHistory(data as any);
  };

  const logHistory = async (song: Song) => {
    if (!user) return;
    await supabase.from('history').insert({
      user_id: user.id,
      video_id: song.videoId,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
    });
  };

  const toggleFavorite = async (song: Song) => {
    if (!user) return;
    const isFav = favorites.some(f => f.videoId === song.videoId);
    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('item_id', song.videoId);
      setFavorites(f => f.filter(s => s.videoId !== song.videoId));
    } else {
      await supabase.from('favorites').insert({
        user_id: user.id,
        item_id: song.videoId,
        type: 'song',
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
      });
      setFavorites(f => [song, ...f]);
    }
  };

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

  const handleNext = async () => {
    const idx = queueRef.current.findIndex((s) => s.videoId === currentSongRef.current?.videoId);
    
    // Proactive Infinite Radio: Fetch 40 tracks when nearing end of current batch
    if (idx >= queueRef.current.length - 3) {
      const lastSong = currentSongRef.current;
      if (lastSong) {
        console.log("🌌 Deepening AI Radio Vibe...");
        try {
          const res = await api.watch(lastSong.videoId);
          if (res.tracks && res.tracks.length > 0) {
            const nextBatch = res.tracks.slice(1, 40);
            setQueue(q => {
              const uniqueBatch = nextBatch.filter(s => !q.find(sq => sq.videoId === s.videoId));
              return [...q, ...uniqueBatch];
            });
          }
        } catch (e) { console.error(e); }
      }
    }

    if (idx < queueRef.current.length - 1) {
      setCurrentSong(queueRef.current[idx + 1]);
    } else {
      setIsPlaying(false);
    }
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

  const playSong = async (song: Song, songList?: Song[]) => {
    if (!song.videoId) return;
    console.log("▶ Playing:", song.title, "| videoId:", song.videoId);
    
    // Set immediate song to start playback
    setCurrentSong(song);
    setPlayed(0);
    setPlayedSeconds(0);
    setDuration(0);
    logHistory(song);
    
    // NEW: YouTube Music 'Radio' Logic (30+ tracks)
    // If a list was provided (e.g. from an album), use it.
    // Otherwise, generate an AI Radio based on the song clicked.
    if (songList && songList.length > 5) {
      setQueue(songList);
    } else {
      console.log("🔮 Infinite Radio Initializing for:", song.title);
      try {
        const res = await api.watch(song.videoId);
        if (res.tracks && res.tracks.length > 0) {
          // Flattening and diversifying the list
          const radioMix = [song, ...res.tracks.slice(1, 40)]; // Up to 40 tracks of same vibe
          setQueue(radioMix);
        } else {
          setQueue(q => q.find(s => s.videoId === song.videoId) ? q : [...q, song]);
        }
      } catch (e) {
        console.error("Radio Generation Failed:", e);
        setQueue(q => q.find(s => s.videoId === song.videoId) ? q : [...q, song]);
      }
    }
  };

  const handleChipClick = async (chip: string) => {
    setActiveChip(chip);
    try {
      // Mocking discovery path
      const res = await api.search(chip + " songs");
      setHomeData([{ title: chip + " Hits", items: res.results }]);
    } catch (e) { console.error(e); }
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

  const navigateTo = (v: View) => {
    setView(v);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  // ─── Login Screen ────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return <Auth />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ─── Main App ────────────────────────────────────────────────────────────────
  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-visible' : ''}`}>
        <div className="logo-section">
          <Play size={24} fill="#f00" />
          <span>Music</span>
          <button className="mobile-only close-sidebar" onClick={() => setIsSidebarOpen(false)}>
            <ArrowLeft size={24} />
          </button>
        </div>
        <nav>
          <button onClick={() => navigateTo({ name: "home" })} className={view.name === "home" ? "active" : ""}>
            <Home size={24} /> <span>Home</span>
          </button>
          <button onClick={() => navigateTo({ name: "explore" })} className={view.name === "explore" ? "active" : ""}>
            <Compass size={24} /> <span>Explore</span>
          </button>
          <button 
            onClick={() => navigateTo({ name: "library" })} 
            className={view.name === "library" ? "active" : ""}
          >
            <Library size={24} /> <span>Library</span>
          </button>
        </nav>
        <div className="sidebar-divider" />
        <div className="playlists-section">
          <button className="new-playlist-btn" onClick={() => navigateTo({ name: 'library' })}>
            <PlusCircle size={20} /> <span>New Playlist</span>
          </button>
          <div className="playlist-item" onClick={() => navigateTo({ name: 'library' })}>
            <div className="playlist-icon liked"><ThumbsUp size={16} fill="currentColor" /></div>
            <span>Liked Songs</span>
          </div>
        </div>

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
            <button className="mobile-only menu-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            {(view.name === "artist" || view.name === "album" || view.name === "search") && (
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
            <button className="cast-btn" onClick={handleLogout} title="Logout"><Tv size={20} /></button>
            <div className="avatar">{user?.email?.[0].toUpperCase()}</div>
          </div>
        </header>

        <section className="scroll-area">

          {/* ── HOME ── */}
          {view.name === "home" && (
            <div className="home-view">
              <div className="chips">
                {["Energize", "Relax", "Workout", "Commute", "Focus"].map((c) => (
                  <button 
                    key={c} 
                    className={`chip ${activeChip === c ? 'active' : ''}`}
                    onClick={() => handleChipClick(c)}
                  >
                    {c}
                  </button>
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
                          <img src={item.thumbnail} alt="" loading="lazy" />
                          {(item.type === "song" || item.type === "video") && (
                            <div className="play-overlay">
                              <Play size={24} fill="#fff" />
                              <button 
                                className={`fav-btn ${favorites.some(f => f.videoId === item.videoId) ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(item as Song); }}
                              >
                                <ThumbsUp size={16} fill={favorites.some(f => f.videoId === item.videoId) ? "currentColor" : "none"} />
                              </button>
                            </div>
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

          {/* ── LIBRARY ── */}
          {view.name === "library" && (
            <div className="library-view">
              <div className="library-grid">
                <section>
                  <h2>Liked Songs</h2>
                  {favorites.length === 0 ? (
                    <p className="no-data">Your favorites will appear here.</p>
                  ) : (
                    <div className="track-list">
                      {favorites.map((song, i) => (
                        <div key={i} className="track-row" onClick={() => playSong(song, favorites)}>
                          <span className="track-num">{i + 1}</span>
                          <img src={song.thumbnail} alt="" />
                          <div className="track-info-col">
                            <h3>{song.title}</h3>
                            <p>{song.artist}</p>
                          </div>
                          <button 
                            className="fav-btn active"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(song); }}
                          >
                            <ThumbsUp size={16} fill="currentColor" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h2>Recent Activity</h2>
                  {history.length === 0 ? (
                    <p className="no-data">Start listening to build your history!</p>
                  ) : (
                    <div className="track-list">
                      {history.map((song, i) => (
                        <div key={i} className="track-row" onClick={() => playSong(song)}>
                          <span className="track-num">{i + 1}</span>
                          <img src={song.thumbnail} alt="" />
                          <div className="track-info-col">
                            <h3>{song.title}</h3>
                            <p>{song.artist}</p>
                          </div>
                          <button 
                            className={`fav-btn ${favorites.some(f => f.videoId === song.videoId) ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(song); }}
                          >
                            <ThumbsUp size={16} fill={favorites.some(f => f.videoId === song.videoId) ? "#fff" : "none"} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
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
      <footer className="player-bar-v2" onClick={() => window.innerWidth < 768 && setShowMobilePlayer(true)}>
        <div className="progress-bar-container">
          <input
            type="range" min={0} max={0.9999} step="any"
            value={played}
            onChange={handleSeek}
            className="progress-range"
            onClick={(e) => e.stopPropagation()}
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
            <button onClick={(e) => { e.stopPropagation(); handlePrev(); }}><SkipBack size={24} fill="currentColor" /></button>
            <button
              className="play-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (!currentSong) return;
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleNext(); }}><SkipForward size={24} fill="currentColor" /></button>
          </div>

          <div className="actions">
            <div className="progress-labels">
              <span>{formatTime(playedSeconds)} / {formatTime(duration)}</span>
            </div>
            <button
              className="icon-btn"
              onClick={(e) => { e.stopPropagation(); setIsMuted((m) => !m); }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              <Volume2 size={20} style={{ opacity: isMuted ? 0.4 : 1 }} />
            </button>
            <input
              type="range" min={0} max={1} step="any"
              value={isMuted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
              className="volume-range"
              onClick={(e) => e.stopPropagation()}
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
      <AnimatePresence>
        {showMobilePlayer && currentSong && (
          <FullScreenPlayer 
            song={currentSong}
            isPlaying={isPlaying}
            played={played}
            playedSeconds={playedSeconds}
            duration={duration}
            queue={queue}
            favorites={favorites}
            onClose={() => setShowMobilePlayer(false)}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onNext={handleNext}
            onPrev={handlePrev}
            onSeek={handleSeek}
            onPlaySong={playSong}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── FULL SCREEN MOBILE PLAYER ───
const FullScreenPlayer = ({ 
  song, 
  isPlaying, 
  played, 
  playedSeconds, 
  duration, 
  onClose, 
  onTogglePlay, 
  onNext, 
  onPrev, 
  onSeek,
  queue,
  onPlaySong,
  favorites,
  onToggleFavorite
}: any) => {
  return (
    <motion.div 
      className="mobile-player-overlay"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <header className="mobile-player-header">
        <button className="close-btn" onClick={onClose}><SkipBack size={24} style={{ transform: 'rotate(-90deg)' }} /></button>
        <div className="title">Now Playing</div>
        <button className="more-btn"><MoreVertical size={24} /></button>
      </header>

      <div className="player-content-scroll">
        <div className="player-hero">
          <motion.img 
            layoutId={`player-thumb-${song.videoId}`}
            src={song.thumbnail} 
            alt="" 
            className="big-thumb" 
          />
          <div className="meta">
            <div className="text">
              <h2>{song.title}</h2>
              <p>{song.artist}</p>
            </div>
            <button 
              className={`fav-btn ${favorites.includes(song.videoId) ? 'active' : ''}`}
              onClick={() => onToggleFavorite(song)}
            >
              <ThumbsUp size={24} fill={favorites.includes(song.videoId) ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="player-controls-section">
          <div className="progress-section">
            <input 
              type="range" min={0} max={0.9999} step="any"
              value={played}
              onChange={onSeek}
              className="mobile-progress"
            />
            <div className="time-labels">
              <span>{Math.floor(playedSeconds/60)}:{(Math.floor(playedSeconds%60)).toString().padStart(2,'0')}</span>
              <span>{Math.floor(duration/60)}:{(Math.floor(duration%60)).toString().padStart(2,'0')}</span>
            </div>
          </div>
          
          <div className="main-btns">
            <button onClick={onPrev}><SkipBack size={32} fill="currentColor" /></button>
            <button className="big-play" onClick={onTogglePlay}>
              {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" />}
            </button>
            <button onClick={onNext}><SkipForward size={32} fill="currentColor" /></button>
          </div>
        </div>

        <div className="mobile-up-next">
          <h3>Up Next</h3>
          <div className="up-next-list">
            {queue.map((s: any, i: number) => (
              <div 
                key={i} 
                className={`next-row ${song.videoId === s.videoId ? 'active' : ''}`}
                onClick={() => onPlaySong(s)}
              >
                <img src={s.thumbnail} alt="" />
                <div className="txt">
                  <p className="t">{s.title}</p>
                  <p className="a">{s.artist}</p>
                </div>
                <MoreVertical size={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default App;

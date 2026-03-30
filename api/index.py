import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from ytmusicapi import YTMusic

app = Flask(__name__)
CORS(app)

# Initialize YTMusic
headers_file = os.path.join(os.path.dirname(__file__), 'headers.json')
yt = YTMusic(headers_file) if os.path.exists(headers_file) else YTMusic()

def safe_thumb(thumbs):
    """Returns a high-resolution thumbnail URL or a fallback."""
    if not thumbs:
        return "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=544&h=544&fit=crop"
    url = sorted(thumbs, key=lambda t: t.get("width", 0), reverse=True)[0].get("url", "")
    if "googleusercontent.com" in url or "ggpht.com" in url:
        return f"{url.split('=')[0]}=w544-h544-l90-rj"
    return url

def fmt_song(item):
    """Standardizes song objects for the frontend."""
    artist_data = item.get("artists", item.get("artist", []))
    artist_name = "Unknown Artist"
    if isinstance(artist_data, list) and artist_data:
        artist_name = artist_data[0].get("name", "Unknown Artist") if isinstance(artist_data[0], dict) else str(artist_data[0])
    
    return {
        "videoId": item.get("videoId", ""),
        "title": item.get("title", "Unknown"),
        "artist": artist_name,
        "album": item.get("album", {}).get("name", "") if isinstance(item.get("album"), dict) else "",
        "thumbnail": safe_thumb(item.get("thumbnails", [])),
        "duration": item.get("duration", ""),
        "type": "song"
    }

@app.route("/api/home")
def home():
    sections = []
    try:
        results = yt.get_home(limit=12)
        for section in results:
            items = [fmt_song(i) for i in section.get("contents", []) if i.get("videoId") or i.get("resultType") == "song"]
            if items:
                sections.append({"title": section.get("title", "Recommended"), "items": items})
    except:
        pass
    return jsonify({"sections": sections})

@app.route("/api/search")
def search():
    q = request.args.get("q", "")
    if not q: return jsonify({"results": []})
    results = [fmt_song(i) for i in yt.search(q, limit=20) if i.get("resultType") == "song"]
    return jsonify({"results": results})

@app.route("/api/playlist/<id>")
@app.route("/api/album/<id>")
def get_collection(id):
    # Works for both albums and playlists
    try:
        data = yt.get_album(id) if "album" in request.path else yt.get_playlist(id, limit=100)
        return jsonify({
            "title": data.get("title", "Collection"),
            "thumbnail": safe_thumb(data.get("thumbnails", [])),
            "tracks": [fmt_song(t) for t in data.get("tracks", [])]
        })
    except:
        return jsonify({"error": "Failed to fetch collection"}), 500

@app.route("/api/watch/<video_id>")
def watch(video_id):
    try:
        seen_ids = set()
        all_tracks = []

        def add_unique(tracks_list):
            for t in tracks_list:
                vid = t.get("videoId", "")
                if vid and vid not in seen_ids:
                    seen_ids.add(vid)
                    all_tracks.append(fmt_song(t))

        # 1. Primary: YouTube's "Up Next" queue
        try:
            data = yt.get_watch_playlist(video_id, limit=50)
            add_unique(data.get("tracks", []))
        except: pass

        # 2. Extract artist/title for smarter searches
        song_artist = all_tracks[0].get("artist", "") if all_tracks else ""
        song_title = all_tracks[0].get("title", "") if all_tracks else ""

        # 3. More songs by same artist
        if song_artist and song_artist != "Unknown Artist":
            try:
                add_unique([r for r in yt.search(song_artist, filter="songs", limit=15) if r.get("resultType") == "song"])
            except: pass

        # 4. Language-aware: search by title keywords
        if song_title:
            keywords = [w for w in song_title.split() if len(w) > 2]
            query = " ".join(keywords[:3]) if keywords else song_title
            try:
                add_unique([r for r in yt.search(query, filter="songs", limit=15) if r.get("resultType") == "song"])
            except: pass

        # 5. Radio fallback if still low
        if len(all_tracks) < 30:
            try:
                radio = yt.get_watch_playlist(video_id, limit=50, radio=True)
                add_unique(radio.get("tracks", []))
            except: pass

        final = [t for t in all_tracks if t.get("videoId") != video_id]
        return jsonify({"tracks": final})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

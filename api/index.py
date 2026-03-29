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
    # Provides the infinite queue logic
    data = yt.get_watch_playlist(video_id, limit=50)
    return jsonify({"tracks": [fmt_song(t) for t in data.get("tracks", [])]})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

from ytmusicapi import YTMusic
import json

yt = YTMusic()
print("Initialized... searching for 'Hindi Songs'...")
try:
    results = yt.search("Hindi Songs", limit=5)
    print(json.dumps(results, indent=2))
except Exception as e:
    print(f"Error: {e}")

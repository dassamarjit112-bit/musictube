import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in .env");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// Database Schema Helper
export type Profile = {
  id: string; // auth.uid()
  email: string;
  avatar_url: string;
  full_name: string;
}

export type HistoryItem = {
  id?: string;
  user_id: string;
  video_id: string;
  title: string;
  artist: string;
  thumbnail: string;
  played_at?: string;
}

export type Favorite = {
  id?: string;
  user_id: string;
  item_id: string;
  type: "song" | "album" | "artist" | "playlist";
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
}

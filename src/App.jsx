import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [channels, setChannels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem("favorites") || "[]"));
  const [epg, setEpg] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const videoRef = useRef(null);

  const handleLogin = async () => {
    const url = `${serverUrl}/player_api.php?username=${username}&password=${password}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const liveChannels = data.live_streams || [];
      setChannels(liveChannels);
      const uniqueGroups = ["All", ...new Set(liveChannels.map((ch) => ch.category_name))];
      setGroups(uniqueGroups);
      const epgUrl = `${serverUrl}/xmltv.php?username=${username}&password=${password}`;
      fetch(epgUrl)
        .then((res) => res.text())
        .then((xml) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, "text/xml");
          const programs = Array.from(doc.querySelectorAll("programme")).map((p) => ({
            channel: p.getAttribute("channel"),
            title: p.querySelector("title")?.textContent,
            start: p.getAttribute("start"),
            stop: p.getAttribute("stop"),
          }));
          setEpg(programs);
        });
    } catch (err) {
      alert("Login failed or invalid server response.");
    }
  };

  useEffect(() => {
    if (selectedChannel && videoRef.current) {
      const streamUrl = `${serverUrl}/live/${username}/${password}/${selectedChannel.stream_id}.m3u8`;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);
      } else {
        videoRef.current.src = streamUrl;
      }
    }
  }, [selectedChannel]);

  const toggleFavorite = (channelId) => {
    const updatedFavorites = favorites.includes(channelId)
      ? favorites.filter((id) => id !== channelId)
      : [...favorites, channelId];
    setFavorites(updatedFavorites);
    localStorage.setItem("favorites", JSON.stringify(updatedFavorites));
  };

  const filteredChannels = channels.filter((ch) =>
    selectedGroup === "All" || ch.category_name === selectedGroup
  );

  const getCurrentEpg = (channel) => {
    const now = new Date();
    return epg.find((p) => {
      const start = new Date(p.start.slice(0, 14).replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5"));
      const stop = new Date(p.stop.slice(0, 14).replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5"));
      return p.channel === channel.epg_channel_id && now >= start && now <= stop;
    });
  };

  return (
    <div className="p-4 max-w-screen-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">IPTV Web Player</h1>

      <div className="space-y-2 mb-4">
        <input
          className="border p-2 w-full"
          placeholder="Server URL (e.g. http://yourserver.com:8080)"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleLogin}>
          Log in & Load Channels
        </button>
      </div>

      {selectedChannel && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Now Playing: {selectedChannel.name}</h2>
          <video ref={videoRef} controls autoPlay width="100%" className="rounded shadow" />
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <select
          className="border p-2 rounded"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Channel List</h3>
        <ul className="max-h-80 overflow-y-auto border rounded p-2 space-y-1">
          {filteredChannels.map((ch) => (
            <li
              key={ch.stream_id}
              className="cursor-pointer hover:bg-blue-100 p-1 rounded flex justify-between items-center"
            >
              <div onClick={() => setSelectedChannel(ch)}>
                <span className="font-semibold">{ch.name}</span>
                <br />
                <small className="text-gray-600 italic">{getCurrentEpg(ch)?.title || "No EPG"}</small>
              </div>
              <button
                className="ml-2 text-yellow-500 text-xl"
                onClick={() => toggleFavorite(ch.stream_id)}
              >
                {favorites.includes(ch.stream_id) ? "★" : "☆"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;

import "./App.css";
import { useState } from "react";

export default function App() {
  const videoDurations = [
    "Short (< 4 minutes)",
    "Medium (4 - 20 minutes)",
    "Long (> 20 minutes)",
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideoDuration, setSelectedVideoDuration] = useState(
    videoDurations[0]
  );
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = Object.fromEntries(new FormData(e.target).entries());
    if (payload.searchTerm === "") {
      return alert("Please enter a search term");
    }
    payload.videoDuration = mapVideoDuration(payload.videoDuration);

    setLoading(true);
    setSearchResults([]);
    try {
      const response = await fetch("http://localhost:3001/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      alert(err);
    }
    setLoading(false);
  }

  function mapVideoDuration(duration) {
    switch (duration) {
      case "Short (< 4 minutes)":
        return "short";
      case "Medium (4 - 20 minutes)":
        return "medium";
      case "Long (> 20 minutes)":
        return "long";
      default:
        return "short";
    }
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-SG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <div className="app">
      <div className="search-bar-container">
        <h1>Youtube Video Summary</h1>
        <form onSubmit={handleSubmit}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search"
              name="searchTerm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit">Search</button>
          </div>
          <div className="search-filters">
            {videoDurations.map((duration, index) => (
              <div className="search-filter" key={index}>
                <input
                  type="radio"
                  id={duration}
                  name="videoDuration"
                  value={duration}
                  checked={selectedVideoDuration === duration}
                  onChange={(e) => setSelectedVideoDuration(e.target.value)}
                />
                <label>{duration}</label>
              </div>
            ))}
          </div>
        </form>
      </div>
      {searchResults.length > 0 ? (
        <div className="search-results-container">
          <h2>Search Results ({searchResults.length})</h2>
          <div className="search-results">
            {searchResults.map(
              ({
                channelName,
                channelThumbnail,
                link,
                publishedAt,
                videoId,
                videoThumbnail,
                title,
                summary,
              }) => (
                <div className="search-result-container" key={videoId}>
                  <div className="search-result-top">
                    <div className="search-result-video-thumbnail">
                      <a href={link} target="_blank" rel="noreferrer">
                        <img src={videoThumbnail} alt="" />
                      </a>
                    </div>
                    <div className="search-result-details">
                      <div className="search-result-title">{title}</div>
                      <div className="search-result-channel">
                        <img
                          className="search-result-channel-thumbnail"
                          src={channelThumbnail}
                          alt=""
                        />
                        <span className="search-result-channel-name">
                          {channelName}
                        </span>
                      </div>
                      <div className="search-result-published-date">
                        Published on {formatDate(publishedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="search-result-bottom">
                    <div className="search-result-summary">
                      <p>Summary: {summary || "No summary found"}</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ) : loading ? (
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      ) : (
        <div className="container"></div>
      )}
    </div>
  );
}

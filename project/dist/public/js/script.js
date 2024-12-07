const socket = io();
const markers = {};
const paths = {};
const geofences = new Map();
let username = prompt("Enter your name:");
let userSettings = {
  darkMode: localStorage.getItem('darkMode') === 'true'
};

// Initialize theme
if (userSettings.darkMode) {
  document.body.classList.add('dark-mode');
  updateThemeIcons(true);
}

socket.emit("set-username", username);

// Initialize map with dark/light mode support
const map = L.map("map").setView([0, 0], 16);
let currentTileLayer;

function updateMapTheme(isDark) {
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }
  
  const tileUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    
  currentTileLayer = L.tileLayer(tileUrl, {
    attribution: 'Vikas.dev',
  }).addTo(map);
}

updateMapTheme(userSettings.darkMode);

// Theme toggle functionality
const themeToggle = document.getElementById('theme-toggle');
const darkIcon = document.querySelector('.dark-icon');
const lightIcon = document.querySelector('.light-icon');

function updateThemeIcons(isDark) {
  darkIcon.style.display = isDark ? 'none' : 'block';
  lightIcon.style.display = isDark ? 'block' : 'none';
}

themeToggle.addEventListener('click', () => {
  userSettings.darkMode = !userSettings.darkMode;
  document.body.classList.toggle('dark-mode');
  updateMapTheme(userSettings.darkMode);
  updateThemeIcons(userSettings.darkMode);
  localStorage.setItem('darkMode', userSettings.darkMode);
});

// Location tracking
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      socket.emit("send-location", { 
        latitude, 
        longitude,
        timestamp: Date.now()
      });
    },
    (error) => console.error(error),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}

// Socket event handlers
socket.on("receive-location", (data) => {
  const { id, latitude, longitude, username, weather } = data;
  
  if (!markers[id]) {
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-content">
              <div class="marker-arrow"></div>
              <div class="marker-info">${username}</div>
            </div>`
    });
    
    markers[id] = L.marker([latitude, longitude], { icon }).addTo(map);
    paths[id] = L.polyline([], { color: getRandomColor() }).addTo(map);
    markers[id].bindPopup(createPopupContent(data)).openPopup();
  } else {
    markers[id].setLatLng([latitude, longitude]);
    paths[id].addLatLng([latitude, longitude]);
    markers[id].getPopup().setContent(createPopupContent(data));
  }
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    map.removeLayer(paths[id]);
    delete markers[id];
    delete paths[id];
  }
});

socket.on("user-list", (users) => {
  const userListElement = document.getElementById("userList");
  userListElement.innerHTML = users.map(user => `
    <li class="user-item">
      <span class="user-name">${user.username}</span>
      <span class="user-status online"></span>
    </li>
  `).join('');
});

// Utility functions
function createPopupContent(data) {
  const { username, timestamp, weather } = data;
  let content = `
    <div class="popup-content">
      <h3>${username}</h3>
      <div class="info-row">
        <span class="label">Last update:</span>
        <span class="value">${moment(timestamp).fromNow()}</span>
      </div>`;

  if (weather) {
    content += `
      <div class="weather-info">
        <div class="weather-row">
          <img class="weather-icon" src="https://openweathermap.org/img/wn/${weather.icon}@2x.png" alt="Weather icon">
          <span class="value">${weather.description}</span>
        </div>
        <div class="weather-row">
          <span class="label">Temperature:</span>
          <span class="value">${weather.temperature}°C</span>
        </div>
        <div class="weather-row">
          <span class="label">Wind:</span>
          <span class="value">${weather.windSpeed} km/h</span>
          <span class="wind-direction" style="transform: rotate(${weather.windDirection}deg)">➜</span>
        </div>
      </div>`;
  }

  content += '</div>';
  return content;
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
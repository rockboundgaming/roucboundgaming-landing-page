function addStreamer(c) {
  const container = document.getElementById("twitch-embed");
  
  const wrapper = document.createElement('div');
  wrapper.className = 'creator-featured'; 
  wrapper.id = `wrapper-${c.twitch}`;
  wrapper.style.display = 'none'; // Hide initially
  wrapper.innerHTML = `
    <div class="creator-featured-header">
      <div class="creator-avatar"><i class="fas fa-user"></i></div>
      <div class="creator-info">
        <h3 class="creator-name">${c.name}</h3>
        <p class="creator-level">Level ${c.level}</p>
      </div>
      <div class="creator-status-badge">LIVE</div>
    </div>
    <div id="player-${c.twitch}" class="twitch-embed-container"></div>
  `;
  container.appendChild(wrapper); // Append hidden

  // Create player immediately
  try {
    if (!window.Twitch || !window.Twitch.Player) {
      console.error("Twitch Player not available");
      removeStreamer(c.twitch);
      return;
    }

    const hostname = window.location.hostname === "" ? "localhost" : window.location.hostname;
    
    const player = new Twitch.Player(`player-${c.twitch}`, {
      channel: c.twitch,
      width: "100%",
      height: 350,
      parent: [hostname],
      autoplay: true,
      muted: true
    });

    let hasStartedPlayback = false;
    let offlineTimeout;
    
    if (player.addEventListener) {
      player.addEventListener(Twitch.Player.READY, () => {
        console.log(`${c.twitch} player ready`);
      });

      player.addEventListener(Twitch.Player.ONLINE, () => {
        console.log(`${c.twitch} came ONLINE`);
        hasStartedPlayback = true;
        clearTimeout(offlineTimeout);
        wrapper.style.display = 'block'; // Show only when confirmed live
      });

      player.addEventListener(Twitch.Player.OFFLINE, () => {
        console.log(`${c.twitch} went OFFLINE`);
        removeStreamer(c.twitch);
      });
    }

    // Auto-remove if stream doesn't go online within 10 seconds
    offlineTimeout = setTimeout(() => {
      if (!hasStartedPlayback) {
        console.log(`${c.twitch} timeout - removing player`);
        removeStreamer(c.twitch);
      }
    }, 10000);

    activePlayers.set(c.twitch, player);
    console.log(`Player initialized for ${c.twitch}`);
  } catch (e) {
    console.error("Player Init Error:", e);
    removeStreamer(c.twitch);
  }
}

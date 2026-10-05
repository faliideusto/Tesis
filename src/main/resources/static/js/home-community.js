const icons = {
  friends: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  ranking: '<path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21v-4h8v4M6 21h12"/>',
  missions: '<path d="M8 4H5v17h14V4h-3M9 2h6v4H9zM8 11l2 2 5-5M8 17h7"/>',
};

/** Static entry points. Account navigation owns authentication and destination state. */
export function homeCommunity() {
  const entries = [
    ['amigos', 'friends', 'Amigos', 'Reúne a tu academia'],
    ['ranking', 'ranking', 'Ranking global', 'Tu puesto en la academia'],
    ['misiones', 'missions', 'Misiones', 'Retos diarios y semanales'],
  ];
  return `<section class="home-community" aria-labelledby="home-community-title">
    <div class="home-community-heading"><h2 id="home-community-title">Más allá de la mesa</h2><span>Tu academia</span></div>
    <nav class="home-community-links" aria-label="Comunidad de Tesis">${entries.map(([route, icon, title, subtitle]) => `
      <a class="home-community-link home-community-${route}" href="#${route}">
        <span class="home-community-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</svg></span>
        <span class="home-community-copy"><strong>${title}</strong><span>${subtitle}</span></span>
        <span class="home-community-arrow" aria-hidden="true">↗</span>
      </a>`).join('')}
    </nav>
  </section>`;
}

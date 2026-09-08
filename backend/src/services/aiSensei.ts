// AI Anime Sensei Smart Recommendation & Context Engine

export function generateSmartFallbackReply(query: string, _context?: any, _mode: string = 'general'): string {
  const q = (query || '').toLowerCase();

  if (q.includes('fate') && (q.includes('order') || q.includes('watch'))) {
    return `### 🧭 **Fate Series: Recommended Watch Order**

The Fate franchise can be intimidating, but here is the definitive community-approved route:

1. **[Fate/stay night: Unlimited Blade Works]** (Ufotable TV Series - 2014) — *Best entry point! Gorgeous animation and introduces the Holy Grail War fundamentals.*
2. **[Fate/stay night: Heaven's Feel]** (Movie Trilogy: Presage Flower, Lost Butterfly, Spring Song) — *The darkest, highest budget visual masterpiece.*
3. **[Fate/Zero]** (2 Seasons - 2011) — *The prequel series. Watching this after UBW and Heaven's Feel delivers maximum narrative payoff without spoiling the mystery.*
4. **Spin-offs (Watch anytime after)**:
   - **[Fate/Apocrypha]** — Great 14-servant team war.
   - **[Fate/Grand Order: Absolute Demonic Front - Babylonia]** — Epic mythic action.`;
  }

  if (q.includes('monogatari') && (q.includes('order') || q.includes('watch'))) {
    return `### 📚 **Monogatari Series: Recommended Watch Order (Light Novel Order)**

1. **[Bakemonogatari]** (15 Episodes)
2. **[Kizumonogatari]** (Trilogy of movies: Tekketsu, Nekketsu, Reiketsu)
3. **[Nisemonogatari]** (11 Episodes)
4. **[Nekomonogatari: Kuro]** (4 Episodes)
5. **[Monogatari Series: Second Season]** (26 Episodes)
6. **[Hanamonogatari]** (5 Episodes)
7. **[Tsukimonogatari]** (4 Episodes)
8. **[Owarimonogatari]** (Season 1 & 2)
9. **[Zoku Owarimonogatari]** (6 Episodes)`;
  }

  if (q.includes('vibe') || q.includes('like') || q.includes('similar')) {
    return `### 🔮 **Vibe Matcher Recommendations**

Based on top acclaimed anime with gripping pacing, outstanding animation, and unforgettable characters:

- **[Jujutsu Kaisen]** — Modern occult dark fantasy with world-class fight choreography and pacing.
- **[Chainsaw Man]** — Gritty, cinematic, unhinged action with top-tier MAPPA production.
- **[Frieren: Beyond Journey's End]** — A deeply moving fantasy masterpiece about time, memory, and companionship.
- **[Solo Leveling]** — High-octane power progression, dynamic dungeon raids, and incredible musical score.
- **[Cyberpunk: Edgerunners]** — Fast-paced, visually electric sci-fi tragedy by Studio Trigger.`;
  }

  if (q.includes('gem') || q.includes('underrated')) {
    return `### 💎 **Hidden Gems & Modern Masterpieces**

Here are outstanding anime that deserve more spotlight:

- **[Odd Taxi]** — A witty, intricately plotted mystery thriller disguised as an anthropomorphic drama.
- **[The Apothecary Diaries]** — Fascinating historical mystery and palace intrigue with an endearing chemist protagonist.
- **[Summer Time Rendering]** — A thrilling supernatural time-loop mystery on a secluded Japanese island.
- **[Dungeon Meshi]** (Delicious in Dungeon) — Brilliant world-building blending classic D&D fantasy with culinary craft.
- **[Vivy: Fluorite Eye's Song]** — Sci-fi time travel AI spectacle with incredible Wit Studio animation.`;
  }

  return `### ✨ **AniAI Sensei Recommendations**

Here are highly acclaimed anime tailored for you:

- **[Frieren: Beyond Journey's End]** — Acclaimed #1 rated modern fantasy with heartfelt storytelling and spectacular battles.
- **[Attack on Titan]** — Epic dark fantasy mystery with relentless plot twists and jaw-dropping lore.
- **[Bocchi the Rock!]** — Heartwarming, inventive comedy with creative animation and relatable social awkwardness.
- **[Vinland Saga]** — Historic viking epic chronicling growth, vengeance, and true peace.

*💡 Tip: Type any anime title or ask me "What should I watch next if I loved X?" or "Explain the timeline of Y"!*`;
}

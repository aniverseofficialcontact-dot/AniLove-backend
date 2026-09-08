// Tracker User Cloud Synchronization Service (AniList, MyAnimeList & Local Profiles)

export const userSyncStore = new Map<string, any>();

export async function verifyAniListToken(token: string): Promise<{ id: string; name: string; avatar?: any; provider: 'anilist' } | null> {
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { Viewer { id name avatar { medium large } bannerImage } }`,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const viewer = json?.data?.Viewer;
    if (!viewer) return null;
    return {
      id: `ani_${viewer.id}`,
      name: viewer.name,
      avatar: viewer.avatar?.large || viewer.avatar?.medium,
      provider: 'anilist',
    };
  } catch (err) {
    console.error('Failed to verify AniList token on server:', err);
    return null;
  }
}

export async function verifyMALToken(token: string): Promise<{ id: string; name: string; avatar?: any; provider: 'mal' } | null> {
  try {
    const res = await fetch('https://api.myanimelist.net/v2/users/@me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'AniLove/4.0',
      },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: `mal_${data.id || data.name.toLowerCase()}`,
        name: data.name,
        avatar: data.picture,
        provider: 'mal',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveTrackerUser(token: string): Promise<{ id: string; name: string; avatar?: string; provider: string } | null> {
  if (!token) return null;

  // 1. Explicit MAL username
  if (token.startsWith('mal_user:')) {
    const username = token.replace('mal_user:', '').trim();
    return { id: `mal_${username.toLowerCase()}`, name: username, provider: 'mal' };
  }

  // 2. Explicit AniList username
  if (token.startsWith('anilist_user:')) {
    const username = token.replace('anilist_user:', '').trim();
    return { id: `ani_${username.toLowerCase()}`, name: username, provider: 'anilist' };
  }

  // 3. Explicit Local Profile
  if (token.startsWith('profile_') || token.startsWith('local_')) {
    const pName = token.replace(/^(profile_|local_)/, '').trim();
    return { id: `local_${pName.toLowerCase()}`, name: pName, provider: 'local' };
  }

  // 4. AniList OAuth Token
  const aniViewer = await verifyAniListToken(token);
  if (aniViewer) return aniViewer;

  // 5. MyAnimeList OAuth Token
  const malViewer = await verifyMALToken(token);
  if (malViewer) return malViewer;

  // Fallback: Use token hash as unique user ID
  return {
    id: `usr_${token.slice(0, 24)}`,
    name: 'Anime Explorer',
    provider: 'generic',
  };
}

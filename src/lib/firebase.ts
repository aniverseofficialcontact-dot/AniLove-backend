import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserSettings, UserMediaListItem } from '../types';

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Authentication helper functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/unauthorized-domain') {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      const friendlyError = new Error(
        `Domain not authorized for Google Sign-in. In Firebase Console (ultra-vista-88chg) -> Authentication -> Settings -> Authorized Domains, add: "${hostname}". You can continue using AniLove as a guest.`
      );
      (friendlyError as any).code = 'auth/unauthorized-domain';
      (friendlyError as any).domain = hostname;
      console.warn('Google Sign-in domain not authorized:', hostname);
      throw friendlyError;
    }
    console.error('Google Sign-in Error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign-out Error:', error);
    throw error;
  }
};

// Firestore User Profile Sync
export const syncUserProfileToCloud = async (
  user: FirebaseUser,
  settings: Partial<UserSettings>,
  libraryCount: number = 0
) => {
  if (!user) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        userId: user.uid,
        displayName: settings.customDisplayName || user.displayName || 'Anime Fan',
        email: user.email || '', // Dynamic Firebase Google Account Email
        photoURL: settings.customAvatar || user.photoURL || '',
        lastActiveAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        libraryCount,
        profiles: settings.profiles || [],
        currentProfileId: settings.currentProfileId || null,
        profilePinEnabled: settings.profilePinEnabled || false,
        profilePin: settings.profilePin || null,
        profilePinBackupQuestion: settings.profilePinBackupQuestion || 'what/who do you like most?',
        profilePinBackupAnswer: settings.profilePinBackupAnswer || null,
        contentRestrictions: settings.contentRestrictions || false,
        importUsername: settings.importUsername || null,
        anilistToken: settings.anilistToken || null,
        twoWaySyncEnabled: settings.twoWaySyncEnabled ?? true,
        preferences: {
          preferredAudio: settings.preferredAudio || 'sub',
          theme: settings.theme || 'midnight',
          autoPlayNextEpisode: settings.autoPlayNextEpisode ?? true,
          notificationsEnabled: settings.notificationsEnabled ?? true,
          notifyAiringEpisodes: settings.notifyAiringEpisodes ?? true,
          syncScores: settings.syncScores ?? true,
          syncEpisodeProgress: settings.syncEpisodeProgress ?? true,
          syncWatchStatus: settings.syncWatchStatus ?? true,
        },
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error syncing profile to Firestore:', error);
  }
};

// Save an item to Cloud Firestore Library
export const saveAnimeToCloudLibrary = async (
  userId: string,
  item: UserMediaListItem
) => {
  if (!userId || !item?.mediaId) return;
  try {
    const itemRef = doc(db, 'users', userId, 'library', String(item.mediaId));
    await setDoc(
      itemRef,
      {
        animeId: item.mediaId,
        userId,
        title: item.media?.title?.userPreferred || item.media?.title?.english || item.media?.title?.romaji || 'Anime',
        coverImage: item.media?.coverImage?.large || item.media?.coverImage?.medium || '',
        status: item.status,
        progress: item.progress,
        score: item.score,
        updatedAt: item.updatedAt || Date.now(),
        media: item.media,
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving anime to cloud library:', error);
  }
};

// Remove an item from Cloud Firestore Library
export const removeAnimeFromCloudLibrary = async (
  userId: string,
  animeId: number
) => {
  if (!userId || !animeId) return;
  try {
    const itemRef = doc(db, 'users', userId, 'library', String(animeId));
    await deleteDoc(itemRef);
  } catch (error) {
    console.error('Error removing anime from cloud library:', error);
  }
};

// Real-time Cloud Library Listener (for multi-device sync)
export const subscribeToCloudLibrary = (
  userId: string,
  onUpdate: (items: UserMediaListItem[]) => void
) => {
  if (!userId) return () => {};
  try {
    const libCollection = collection(db, 'users', userId, 'library');
    return onSnapshot(
      libCollection,
      snapshot => {
        const items: UserMediaListItem[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.animeId && data.media) {
            items.push({
              mediaId: data.animeId,
              status: data.status || 'PLANNING',
              progress: data.progress || 0,
              score: data.score || 0,
              updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
              media: data.media,
            });
          }
        });
        onUpdate(items);
      },
      error => {
        console.error('Error listening to Cloud Library:', error);
      }
    );
  } catch (err) {
    console.error('Failed to setup Cloud Library subscription:', err);
    return () => {};
  }
};

// Save Watch History Item to Cloud Firestore (Real-time Cross-Device Resume)
export const saveWatchHistoryToCloud = async (
  userId: string,
  entry: import('../types').WatchHistoryEntry
) => {
  if (!userId || !entry?.animeId || !entry?.episodeNumber) return;
  try {
    const historyId = `${entry.animeId}_${entry.episodeNumber}`;
    const historyRef = doc(db, 'users', userId, 'watchHistory', historyId);
    await setDoc(
      historyRef,
      {
        id: historyId,
        userId,
        animeId: entry.animeId,
        episodeNumber: entry.episodeNumber,
        episodeTitle: entry.episodeTitle || '',
        seasonTitle: entry.seasonTitle || '',
        currentTime: entry.currentTime,
        duration: entry.duration,
        lastWatchedAt: entry.lastWatchedAt || Date.now(),
        completed: Boolean(entry.completed),
        thumbnailStyle: entry.thumbnailStyle || 'snapshot',
        anime: entry.anime,
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving watch history to Firestore:', error);
  }
};

// Real-time Cloud Watch History Listener (Cross-Device Sync)
export const subscribeToCloudWatchHistory = (
  userId: string,
  onUpdate: (history: import('../types').WatchHistoryEntry[]) => void
) => {
  if (!userId) return () => {};
  try {
    const historyCollection = collection(db, 'users', userId, 'watchHistory');
    return onSnapshot(
      historyCollection,
      snapshot => {
        const history: import('../types').WatchHistoryEntry[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.animeId && data.episodeNumber && data.anime) {
            history.push({
              animeId: data.animeId,
              episodeNumber: data.episodeNumber,
              episodeTitle: data.episodeTitle,
              seasonTitle: data.seasonTitle,
              currentTime: data.currentTime || 0,
              duration: data.duration || 1440,
              lastWatchedAt: data.lastWatchedAt || Date.now(),
              completed: Boolean(data.completed),
              thumbnailStyle: data.thumbnailStyle || 'snapshot',
              anime: data.anime,
            });
          }
        });
        // Sort descending by lastWatchedAt
        history.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
        onUpdate(history);
      },
      error => {
        console.error('Error listening to Cloud Watch History:', error);
      }
    );
  } catch (err) {
    console.error('Failed to setup Cloud Watch History subscription:', err);
    return () => {};
  }
};

// Save Quiz Score Record to Cloud Firestore
export const saveQuizScoreToCloud = async (
  userId: string,
  animeId: number,
  animeTitle: string,
  score: number,
  total: number = 5
) => {
  if (!userId) return;
  try {
    const scoreId = `${animeId}_${Date.now()}`;
    const scoreRef = doc(db, 'users', userId, 'quizScores', scoreId);
    await setDoc(scoreRef, {
      id: scoreId,
      userId,
      animeId,
      animeTitle,
      score,
      total,
      percentage: Math.round((score / total) * 100),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Error saving quiz score to Firestore:', error);
  }
};

// Save Arcade & Collectible Game Data to Cloud Firestore
export const saveGameDataToCloudFirestore = async (
  userId: string,
  gameData: {
    coins: number;
    characterCards: any[];
    cardAwakenings: Record<string, number>;
    activeCompanion: any;
    watchHistory?: any[];
    dailyGameRecords?: Record<string, any>;
  }
) => {
  if (!userId) return;
  try {
    const gameDocRef = doc(db, 'users', userId, 'gameData', 'arcade_state');
    await setDoc(
      gameDocRef,
      {
        userId,
        coins: typeof gameData.coins === 'number' ? gameData.coins : 10,
        characterCards: Array.isArray(gameData.characterCards) ? gameData.characterCards : [],
        cardAwakenings: gameData.cardAwakenings || {},
        activeCompanion: gameData.activeCompanion || null,
        dailyGameRecords: gameData.dailyGameRecords || {},
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Firestore game data sync warning:', error);
  }
};

// Fetch Arcade & Collectible Game Data from Cloud Firestore
export const fetchGameDataFromCloudFirestore = async (userId: string) => {
  if (!userId) return null;
  try {
    const gameDocRef = doc(db, 'users', userId, 'gameData', 'arcade_state');
    const snap = await getDoc(gameDocRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    console.warn('Firestore game data fetch warning:', error);
    return null;
  }
};


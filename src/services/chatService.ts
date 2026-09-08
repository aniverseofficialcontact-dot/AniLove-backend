import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { User as FirebaseUser, signInAnonymously } from 'firebase/auth';
import { ChatUserProfile, ChatMessage, ChatConversation, ChatMessageType, AnimeReel, Anime, UserSettings } from '../types';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000; // 5 days message disappearance

/**
 * Resolves the persistent Cross-Device Identity UID from Google or AniList Two-Way Sync.
 * Requires either Google Auth or AniList Two-Way Sync OAuth token to prove ownership
 * and prevent unauthorized impersonation of public AniList usernames.
 */
export function getCrossDeviceUserId(
  firebaseUser?: FirebaseUser | null,
  settings?: UserSettings | null
): { uid: string; provider: 'google' | 'anilist'; identifier: string; displayName?: string; avatar?: string } | null {
  if (firebaseUser?.uid) {
    return {
      uid: firebaseUser.uid,
      provider: 'google',
      identifier: firebaseUser.email || firebaseUser.displayName || firebaseUser.uid,
      displayName: firebaseUser.displayName || undefined,
      avatar: firebaseUser.photoURL || undefined,
    };
  }
  // AniList authentication REQUIRES a verified Two-Way Sync OAuth token and user ID
  // to prevent anyone from impersonating someone else's public username.
  if (settings?.anilistToken && settings?.anilistUser?.id) {
    return {
      uid: `anilist_${settings.anilistUser.id}`,
      provider: 'anilist',
      identifier: `@${settings.anilistUser.name}`,
      displayName: settings.anilistUser.name,
      avatar: settings.anilistUser.avatar?.large || settings.anilistUser.avatar?.medium,
    };
  }
  return null;
}

/**
 * Validates format of username
 */
export function isValidUsername(username: string): { valid: boolean; error?: string } {
  const clean = username.trim().toLowerCase();
  if (clean.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (clean.length > 20) {
    return { valid: false, error: 'Username cannot exceed 20 characters.' };
  }
  if (!USERNAME_REGEX.test(clean)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  return { valid: true };
}

/**
 * Checks if username is currently available
 */
export async function checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!isValidUsername(clean).valid) return false;

  try {
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        // In case anonymous auth is restricted, continue to check if read is allowed
      }
    }

    const userDocRef = doc(db, 'usernames', clean);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return true;
    
    // If the username document exists, it's available only if the current user already owns it
    const activeUid = currentUserId || auth.currentUser?.uid;
    if (activeUid && snap.data()?.uid === activeUid) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
}

/**
 * Claims a unique username and creates/updates public ChatProfile
 */
export async function claimUsernameAndSaveProfile(
  userId: string,
  rawUsername: string,
  profileData: {
    displayName: string;
    avatar: string;
    bio?: string;
    anilistUsername?: string;
    linkedProvider?: 'google' | 'anilist';
    linkedAccount?: string;
  }
): Promise<{ success: boolean; error?: string; profile?: ChatUserProfile }> {
  const clean = rawUsername.trim().toLowerCase();
  const validation = isValidUsername(clean);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // Check if taken by someone else
    const usernameRef = doc(db, 'usernames', clean);
    const usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists() && usernameSnap.data()?.uid !== userId) {
      return { success: false, error: `The username @${clean} is already taken. Please choose another.` };
    }

    // Check if user previously had a different username so we can release it
    const profileRef = doc(db, 'profiles', userId);
    const existingProfileSnap = await getDoc(profileRef);
    const oldUsername = existingProfileSnap.exists() ? existingProfileSnap.data()?.username : null;

    const batch = writeBatch(db);

    // If user changed username, remove old claim
    if (oldUsername && oldUsername !== clean) {
      batch.delete(doc(db, 'usernames', oldUsername));
    }

    // Claim new username
    batch.set(usernameRef, {
      username: clean,
      uid: userId,
      createdAt: Date.now()
    });

    const now = Date.now();
    const chatProfile: ChatUserProfile = {
      userId,
      username: clean,
      displayName: profileData.displayName.trim() || clean,
      avatar: profileData.avatar || '',
      bio: profileData.bio || '',
      anilistUsername: profileData.anilistUsername || '',
      linkedProvider: profileData.linkedProvider,
      linkedAccount: profileData.linkedAccount,
      createdAt: existingProfileSnap.exists() ? (existingProfileSnap.data()?.createdAt || now) : now,
      lastActive: now,
    };

    // Save public profile
    batch.set(profileRef, chatProfile, { merge: true });

    await batch.commit();

    // Cache locally for instant access
    localStorage.setItem('anilove_chat_profile', JSON.stringify(chatProfile));

    return { success: true, profile: chatProfile };
  } catch (err: any) {
    console.error('Error claiming username:', err);
    return { success: false, error: err.message || 'Failed to claim username. Please try again.' };
  }
}

/**
 * Retrieves public profile by User ID
 */
export async function getChatProfile(userId: string): Promise<ChatUserProfile | null> {
  if (!userId) return null;
  try {
    const profileRef = doc(db, 'profiles', userId);
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      return snap.data() as ChatUserProfile;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch chat profile:', error);
    return null;
  }
}

/**
 * Searches users by username or display name
 */
export async function searchUsersByUsername(searchQuery: string, currentUserId?: string): Promise<ChatUserProfile[]> {
  const clean = searchQuery.trim().toLowerCase().replace(/^@/, '');
  if (!clean || clean.length < 2) return [];

  try {
    const usernameQuery = query(
      collection(db, 'usernames'),
      where('username', '>=', clean),
      where('username', '<=', clean + '\uf8ff'),
      limit(10)
    );
    const snap = await getDocs(usernameQuery);
    const userIds = snap.docs.map(d => d.data().uid).filter(uid => uid && uid !== currentUserId);

    if (userIds.length === 0) {
      return [];
    }

    // Fetch matching profiles
    const profiles: ChatUserProfile[] = [];
    await Promise.all(
      userIds.slice(0, 8).map(async (uid) => {
        const p = await getChatProfile(uid);
        if (p) profiles.push(p);
      })
    );
    return profiles;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Helper to compute canonical chat ID for 1-on-1 conversations
 */
export function getCanonicalChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/**
 * Gets or initializes a 1-on-1 direct message conversation
 */
export async function getOrCreateConversation(
  currentUser: ChatUserProfile,
  recipientUser: ChatUserProfile
): Promise<ChatConversation> {
  const chatId = getCanonicalChatId(currentUser.userId, recipientUser.userId);
  const chatRef = doc(db, 'chats', chatId);

  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      return snap.data() as ChatConversation;
    }

    // Create fresh conversation
    const newConversation: ChatConversation = {
      id: chatId,
      participants: [currentUser.userId, recipientUser.userId],
      participantProfiles: {
        [currentUser.userId]: {
          userId: currentUser.userId,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar || ''
        },
        [recipientUser.userId]: {
          userId: recipientUser.userId,
          username: recipientUser.username,
          displayName: recipientUser.displayName,
          avatar: recipientUser.avatar || ''
        }
      },
      updatedAt: Date.now(),
      unreadCounts: {
        [currentUser.userId]: 0,
        [recipientUser.userId]: 0
      }
    };

    await setDoc(chatRef, newConversation);
    return newConversation;
  } catch (error) {
    console.error('Error creating or fetching conversation:', error);
    throw error;
  }
}

/**
 * Real-time subscription to user conversations
 */
export function subscribeToConversations(
  userId: string,
  onUpdate: (conversations: ChatConversation[]) => void
): () => void {
  if (!userId) return () => {};

  try {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const conversations: ChatConversation[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as ChatConversation;
          if (data && data.id) {
            conversations.push(data);
          }
        });
        onUpdate(conversations);
      },
      (error) => {
        console.error('Error subscribing to conversations:', error);
      }
    );
  } catch (err) {
    console.error('Failed to setup conversations subscription:', err);
    return () => {};
  }
}

/**
 * Real-time subscription to messages within a conversation
 * Automatically excludes messages older than 5 days and triggers cleanup
 */
export function subscribeToMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void
): () => void {
  if (!chatId) return () => {};

  try {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(150)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const activeMessages: ChatMessage[] = [];
        const expiredIds: string[] = [];

        snapshot.forEach(docSnap => {
          const msg = { ...docSnap.data(), id: docSnap.id } as ChatMessage;
          // Check 5-day expiration
          if (msg.expiresAt && msg.expiresAt <= now) {
            expiredIds.push(msg.id);
          } else {
            activeMessages.push(msg);
          }
        });

        onUpdate(activeMessages);

        // Background cleanup of expired messages to keep Firestore neat and storage minimal
        if (expiredIds.length > 0) {
          expiredIds.forEach(id => {
            deleteDoc(doc(db, 'chats', chatId, 'messages', id)).catch(() => {});
          });
        }
      },
      (error) => {
        console.error('Error subscribing to messages:', error);
      }
    );
  } catch (err) {
    console.error('Failed to setup messages subscription:', err);
    return () => {};
  }
}

/**
 * Send a message (text, reel, or anime card) with 5-day expiration
 */
export async function sendChatMessage(
  chatId: string,
  senderId: string,
  receiverId: string,
  messageData: {
    text?: string;
    type: ChatMessageType;
    reelData?: AnimeReel;
    animeData?: Anime;
  }
): Promise<void> {
  if (!chatId || !senderId || !receiverId) return;

  const now = Date.now();
  const expiresAt = now + FIVE_DAYS_MS;

  const messageDocRef = doc(collection(db, 'chats', chatId, 'messages'));
  const messageId = messageDocRef.id;

  let previewText = messageData.text?.trim() || '';
  let payloadReel: any = undefined;
  let payloadAnime: any = undefined;

  if (messageData.type === 'reel' && messageData.reelData) {
    payloadReel = {
      id: messageData.reelData.id,
      cleanTitle: messageData.reelData.cleanTitle,
      url: messageData.reelData.url,
      directUrl: messageData.reelData.directUrl || '',
      thumbnailUrl: messageData.reelData.thumbnailUrl || '',
    };
    previewText = previewText || `🎬 Shared a Reel: ${messageData.reelData.cleanTitle}`;
  } else if (messageData.type === 'anime' && messageData.animeData) {
    payloadAnime = {
      id: messageData.animeData.id,
      title: messageData.animeData.title.english || messageData.animeData.title.romaji || 'Anime',
      coverImage: messageData.animeData.coverImage.large || messageData.animeData.coverImage.medium || '',
      format: messageData.animeData.format || 'TV',
      episodes: messageData.animeData.episodes || 0,
      score: messageData.animeData.averageScore || 0
    };
    previewText = previewText || `📺 Shared Anime: ${payloadAnime.title}`;
  }

  const newMsg: ChatMessage = {
    id: messageId,
    chatId,
    senderId,
    receiverId,
    text: messageData.text?.trim() || '',
    type: messageData.type,
    reelData: payloadReel,
    animeData: payloadAnime,
    timestamp: now,
    expiresAt,
    read: false
  };

  try {
    // 1. Write the message document
    await setDoc(messageDocRef, newMsg);

    // 2. Update parent conversation metadata
    const chatDocRef = doc(db, 'chats', chatId);
    await updateDoc(chatDocRef, {
      lastMessage: {
        text: previewText,
        type: messageData.type,
        senderId,
        timestamp: now
      },
      updatedAt: now,
      [`unreadCounts.${receiverId}`]: increment(1)
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Mark all unread messages as read for the current user in a conversation
 */
export async function markConversationAsRead(chatId: string, userId: string): Promise<void> {
  if (!chatId || !userId) return;
  try {
    const chatDocRef = doc(db, 'chats', chatId);
    await updateDoc(chatDocRef, {
      [`unreadCounts.${userId}`]: 0
    });
  } catch (error) {
    console.warn('Error marking conversation read:', error);
  }
}

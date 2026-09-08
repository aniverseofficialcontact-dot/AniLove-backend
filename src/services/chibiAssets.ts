export interface ChibiCharacterAsset {
  characterName: string;
  chibiImage: string;
  signatureAction: string;
  themeColor: string;
  tagline: string;
}

export const CHIBI_CHARACTER_ASSETS: Record<string, ChibiCharacterAsset> = {
  'Roronoa Zoro': {
    characterName: 'Roronoa Zoro',
    chibiImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    signatureAction: 'Santoryu 3-Katana Stance ⚔️',
    themeColor: 'from-emerald-600 to-teal-700',
    tagline: 'Pirate Hunter • Master of Three-Sword Style',
  },
  'Monkey D. Luffy': {
    characterName: 'Monkey D. Luffy',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png',
    signatureAction: 'Gomu Gomu Stance 👒',
    themeColor: 'from-rose-600 to-amber-600',
    tagline: 'Future King of the Pirates • Straw Hat Captain',
  },
  'Son Goku': {
    characterName: 'Son Goku',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png',
    signatureAction: 'Super Saiyan Power Up ⚡',
    themeColor: 'from-amber-500 to-orange-600',
    tagline: 'Earth’s Mightiest Saiyan Champion',
  },
  'Vegeta': {
    characterName: 'Vegeta',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b913-NIFkKazWM8VO.png',
    signatureAction: 'Saiyan Prince Aura 🔥',
    themeColor: 'from-blue-600 to-indigo-700',
    tagline: 'Prince of all Saiyans • Proud Warrior',
  },
  'Satoru Gojo': {
    characterName: 'Satoru Gojo',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png',
    signatureAction: 'Domain Expansion Hand Sign 🤞',
    themeColor: 'from-violet-600 to-cyan-600',
    tagline: 'The Honored One • Strongest Sorcerer',
  },
  'Levi': {
    characterName: 'Levi',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png',
    signatureAction: 'Blade Whirlwind Spin 🌪️',
    themeColor: 'from-slate-700 to-emerald-800',
    tagline: 'Humanity’s Strongest Soldier',
  },
  'Levi Ackerman': {
    characterName: 'Levi Ackerman',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png',
    signatureAction: 'Blade Whirlwind Spin 🌪️',
    themeColor: 'from-slate-700 to-emerald-800',
    tagline: 'Humanity’s Strongest Soldier',
  },
  'Eren Yeager': {
    characterName: 'Eren Yeager',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg',
    signatureAction: 'Titan Spark Hand Bite ⚡',
    themeColor: 'from-emerald-700 to-rose-700',
    tagline: 'Attacking Titan • Champion of Freedom',
  },
  'Naruto Uzumaki': {
    characterName: 'Naruto Uzumaki',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-76tPnLzZf0rK.png',
    signatureAction: 'Shadow Clone Jutsu 🌀',
    themeColor: 'from-amber-500 to-orange-600',
    tagline: 'Seventh Hokage • Hero of the Hidden Leaf',
  },
  'Sasuke Uchiha': {
    characterName: 'Sasuke Uchiha',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b13-fS7gL8UeK9N0.png',
    signatureAction: 'Chidori Sparks ⚡',
    themeColor: 'from-indigo-600 to-purple-800',
    tagline: 'Shadow Kage • Master of the Sharingan',
  },
  'Killua Zoldyck': {
    characterName: 'Killua Zoldyck',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg',
    signatureAction: 'Godspeed Lightning Flash ⚡',
    themeColor: 'from-cyan-500 to-indigo-600',
    tagline: 'Lightning Prodigy • Ex-Assassin',
  },
  'Tanjiro Kamado': {
    characterName: 'Tanjiro Kamado',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b126071-v42jQ5W9y1jO.png',
    signatureAction: 'Hinokami Sun Breath ☀️',
    themeColor: 'from-emerald-600 to-rose-600',
    tagline: 'Sun Breathing Swordsman',
  },
  'Nezuko Kamado': {
    characterName: 'Nezuko Kamado',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b126072-t62lD542wJ7e.png',
    signatureAction: 'Cute Box Peek & Pyrokinesis 🎀',
    themeColor: 'from-pink-500 to-rose-600',
    tagline: 'Demon Sister with an Unbreakable Heart',
  },
  'Megumin': {
    characterName: 'Megumin',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b89361-9Hl8E14lGk88.png',
    signatureAction: 'Explosion Staff Chant 💥',
    themeColor: 'from-rose-600 to-yellow-600',
    tagline: 'Crimson Demon Arch-Mage',
  },
  'All Might': {
    characterName: 'All Might',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b89362-e92lS214wL89.png',
    signatureAction: 'Symbol of Peace Hero Pose 💪',
    themeColor: 'from-amber-400 to-blue-600',
    tagline: 'Former No. 1 Pro Hero',
  },
  'Saitama': {
    characterName: 'Saitama',
    chibiImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b73935-tQ3N5W6yJ8Lp.png',
    signatureAction: 'Single Serious Punch 👊',
    themeColor: 'from-yellow-500 to-rose-600',
    tagline: 'Hero for Fun • One Punch Master',
  },
};

export function getChibiCharacterAsset(characterName: string, fallbackImage: string): ChibiCharacterAsset {
  const direct = CHIBI_CHARACTER_ASSETS[characterName];
  if (direct) return direct;

  const keys = Object.keys(CHIBI_CHARACTER_ASSETS);
  for (const k of keys) {
    if (characterName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(characterName.toLowerCase())) {
      return CHIBI_CHARACTER_ASSETS[k];
    }
  }

  return {
    characterName,
    chibiImage: fallbackImage,
    signatureAction: 'Heroic Mascot Stance ✨',
    themeColor: 'from-purple-600 to-pink-600',
    tagline: 'Chibi Anime Hero',
  };
}

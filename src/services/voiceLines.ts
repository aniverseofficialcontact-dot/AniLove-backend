import { soundEffects } from './soundEffects';

export interface CharacterVoiceQuote {
  characterName: string;
  japaneseVoiceLine: string;
  romaji: string;
  englishTranslation: string;
  pitch: number; // 0.8 to 1.3
  rate: number;  // 0.8 to 1.1
}

export const ICONIC_VOICE_LINES: Record<string, CharacterVoiceQuote> = {
  'Monkey D. Luffy': {
    characterName: 'Monkey D. Luffy',
    japaneseVoiceLine: '海賊王におれはなるっ！',
    romaji: 'Kaizoku ou ni, ore wa naru!',
    englishTranslation: 'I am going to become the King of the Pirates!',
    pitch: 1.25,
    rate: 1.05,
  },
  'Roronoa Zoro': {
    characterName: 'Roronoa Zoro',
    japaneseVoiceLine: 'なにも...なかった！三千世界！',
    romaji: 'Nani mo... nakatta! Santouryuu Ougi: Sanzen Sekai!',
    englishTranslation: 'Nothing... happened! Three Swords Secret Technique: Three Thousand Worlds!',
    pitch: 0.85,
    rate: 0.95,
  },
  'Son Goku': {
    characterName: 'Son Goku',
    japaneseVoiceLine: 'オラ悟空だ！かめはめ波ーーっ！',
    romaji: 'Ora Goku da! Kamehamehaaaa!',
    englishTranslation: "I'm Goku! Kamehamehaaaa!",
    pitch: 1.15,
    rate: 1.05,
  },
  'Vegeta': {
    characterName: 'Vegeta',
    japaneseVoiceLine: 'オレはサイヤ人の王子、ベジータ様だ！ファイナルフラッシュ！',
    romaji: 'Ore wa Saiyajin no Ouji, Bejiita-sama da! Final Flash!',
    englishTranslation: 'I am the Prince of all Saiyans, the great Vegeta! Final Flash!',
    pitch: 0.9,
    rate: 1.0,
  },
  'Satoru Gojo': {
    characterName: 'Satoru Gojo',
    japaneseVoiceLine: '大丈夫、僕 最強だから。領域展開、無量空処。',
    romaji: 'Daijoubu, boku saikyou dakara. Ryouiki Tenkai: Muryoukuusho.',
    englishTranslation: "Don't worry, I'm the strongest. Domain Expansion: Infinite Void.",
    pitch: 1.0,
    rate: 0.95,
  },
  'Levi': {
    characterName: 'Levi',
    japaneseVoiceLine: '心臓を捧げよ。躾に一番効くのは痛みだと思う。',
    romaji: 'Shinzou wo sasageyo. Shitsuke ni ichiban kiku no wa itami da to omou.',
    englishTranslation: 'Dedicate your heart. I think pain is the most effective discipline.',
    pitch: 0.88,
    rate: 0.92,
  },
  'Levi Ackerman': {
    characterName: 'Levi Ackerman',
    japaneseVoiceLine: '心臓を捧げよ。躾に一番効くのは痛みだと思う。',
    romaji: 'Shinzou wo sasageyo. Shitsuke ni ichiban kiku no wa itami da to omou.',
    englishTranslation: 'Dedicate your heart. I think pain is the most effective discipline.',
    pitch: 0.88,
    rate: 0.92,
  },
  'Eren Yeager': {
    characterName: 'Eren Yeager',
    japaneseVoiceLine: '戦え！戦わなければ勝てない！駆逐してやる！',
    romaji: 'Tatakae! Tatakawanakereba katenai! Kuchiku shite yaru!',
    englishTranslation: "Fight! If you don't fight, you can't win! I will destroy them all!",
    pitch: 0.95,
    rate: 1.05,
  },
  'Naruto Uzumaki': {
    characterName: 'Naruto Uzumaki',
    japaneseVoiceLine: 'まっすぐ自分の言葉は曲げねぇ、それがオレの忍道だ！だってばよ！螺旋丸！',
    romaji: 'Massugu jibun no kotoba wa magenee, sore ga ore no nindou da! Dattebayo! Rasengan!',
    englishTranslation: 'I never go back on my word, that is my ninja way! Believe it! Rasengan!',
    pitch: 1.2,
    rate: 1.05,
  },
  'Sasuke Uchiha': {
    characterName: 'Sasuke Uchiha',
    japaneseVoiceLine: 'オレは復讐者だ。千鳥！',
    romaji: 'Ore wa fukushusha da. Chidori!',
    englishTranslation: 'I am an avenger. Chidori!',
    pitch: 0.9,
    rate: 0.95,
  },
  'Killua Zoldyck': {
    characterName: 'Killua Zoldyck',
    japaneseVoiceLine: 'ゴン、お前は光だ。神速！疾風迅雷！',
    romaji: 'Gon, omae wa hikari da. Kanmuru! Shippuujinrai!',
    englishTranslation: 'Gon, you are light. Godspeed! Lightning speed!',
    pitch: 1.15,
    rate: 1.0,
  },
  'Light Yagami': {
    characterName: 'Light Yagami',
    japaneseVoiceLine: '計画通り。僕は新世界の神となる！',
    romaji: 'Keikaku doori. Boku wa shinsekai no kami to naru!',
    englishTranslation: 'Just as planned. I will become the God of the New World!',
    pitch: 0.95,
    rate: 0.95,
  },
  'L Lawliet': {
    characterName: 'L Lawliet',
    japaneseVoiceLine: '正義は必ず勝つということを。',
    romaji: 'Seigi wa kanarazu katsu to iu koto wo.',
    englishTranslation: 'Justice will prevail, no matter what.',
    pitch: 0.9,
    rate: 0.9,
  },
  'Megumin': {
    characterName: 'Megumin',
    japaneseVoiceLine: '我が名はめぐみん！紅魔族随一の魔法の使い手！エクスプロージョン！',
    romaji: 'Waga na wa Megumin! Koumazoku zuiichi no mahou no tsukaite! Explosion!',
    englishTranslation: 'My name is Megumin! Arch-wizard of the Crimson Demons! EXPLOSION!',
    pitch: 1.3,
    rate: 1.1,
  },
  'Tanjiro Kamado': {
    characterName: 'Tanjiro Kamado',
    japaneseVoiceLine: 'ヒノカミ神楽！円舞！心を燃やせ！',
    romaji: 'Hinokami Kagura! Enbu! Kokoro wo moyase!',
    englishTranslation: 'Hinokami Kagura! Dance! Set your heart ablaze!',
    pitch: 1.05,
    rate: 1.0,
  },
  'Nezuko Kamado': {
    characterName: 'Nezuko Kamado',
    japaneseVoiceLine: 'ふー！血鬼術、爆血！',
    romaji: 'Mmh! Kekkijutsu: Bakketsu!',
    englishTranslation: 'Mmh! Blood Demon Art: Exploding Blood!',
    pitch: 1.35,
    rate: 1.0,
  },
  'Giyuu Tomioka': {
    characterName: 'Giyuu Tomioka',
    japaneseVoiceLine: '水の呼吸、拾壱の型、凪。',
    romaji: 'Mizu no Kokyuu, Juuichi no Kata: Nagi.',
    englishTranslation: 'Water Breathing, Eleventh Form: Dead Calm.',
    pitch: 0.85,
    rate: 0.88,
  },
  'All Might': {
    characterName: 'All Might',
    japaneseVoiceLine: 'もう大丈夫！何故って？私が来た！デトロイトスマッシュ！',
    romaji: 'Mou daijoubu! Naze tte? Watashi ga kita! Detroit Smash!',
    englishTranslation: "It's fine now! Why? Because I am here! Detroit Smash!",
    pitch: 0.92,
    rate: 1.05,
  },
  'Edward Elric': {
    characterName: 'Edward Elric',
    japaneseVoiceLine: '誰がドチビで豆粒サイズだコラー！',
    romaji: 'Dare ga dochibi de mametsubu saizu da koraaa!',
    englishTranslation: 'Who are you calling a pipsqueak midget who is small as a bean?!',
    pitch: 1.2,
    rate: 1.1,
  },
  'Saitama': {
    characterName: 'Saitama',
    japaneseVoiceLine: '趣味でヒーローをやっている者だ。必殺、マジ殴り。',
    romaji: 'Shumi de hiiroo wo yatteiru mono da. Hissatsu: Maji Naguri.',
    englishTranslation: "I'm just a guy who's a hero for fun. Serious Series: Serious Punch.",
    pitch: 0.95,
    rate: 0.95,
  },
  'Lelouch Lamperouge': {
    characterName: 'Lelouch Lamperouge',
    japaneseVoiceLine: 'ルルーシュ・ヴィ・ブリタニアが命じる。貴様たちは、死ね！',
    romaji: 'Lelouch vi Britannia ga meijiru. Kisama-tachi wa, shine!',
    englishTranslation: 'Lelouch vi Britannia commands you: Die!',
    pitch: 0.95,
    rate: 0.92,
  },
  'Spike Spiegel': {
    characterName: 'Spike Spiegel',
    japaneseVoiceLine: 'Bang... Whatever happens, happens.',
    romaji: 'Bang... Whatever happens, happens.',
    englishTranslation: 'Bang... Whatever happens, happens.',
    pitch: 0.85,
    rate: 0.85,
  },
};

export function getCharacterVoiceQuote(characterName: string): CharacterVoiceQuote {
  // Normalize match
  const directMatch = ICONIC_VOICE_LINES[characterName];
  if (directMatch) return directMatch;

  // Partial match
  const keys = Object.keys(ICONIC_VOICE_LINES);
  for (const k of keys) {
    if (characterName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(characterName.toLowerCase())) {
      return ICONIC_VOICE_LINES[k];
    }
  }

  // Generic fallback
  return {
    characterName,
    japaneseVoiceLine: '全力で行くぞ！諦めるな！',
    romaji: 'Zenryoku de ikuzo! Akirameru na!',
    englishTranslation: "Let's go at full power! Never give up!",
    pitch: 1.0,
    rate: 1.0,
  };
}

/**
 * Play authentic anime voice line using Web Speech Synthesis with fallback audio synthesizer
 */
export function playCharacterVoiceLine(
  characterName: string,
  onStart?: () => void,
  onEnd?: () => void
): () => void {
  const quote = getCharacterVoiceQuote(characterName);

  // Play anime power sound effect immediately
  soundEffects.playVoiceShout(quote.pitch);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onStart) onStart();
    setTimeout(() => {
      if (onEnd) onEnd();
    }, 2500);
    return () => {};
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(quote.japaneseVoiceLine);
  utterance.rate = quote.rate;
  utterance.pitch = quote.pitch;
  utterance.volume = 1.0;

  // Try to find a Japanese voice
  const voices = window.speechSynthesis.getVoices();
  const jpVoice = voices.find(v => v.lang.includes('ja') || v.lang.includes('JP') || v.name.includes('Japanese'));
  if (jpVoice) {
    utterance.voice = jpVoice;
    utterance.lang = 'ja-JP';
  } else {
    // English/fallback voice
    utterance.lang = 'ja-JP';
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

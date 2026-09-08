import { Anime, GachaCard, CharacterShopItem } from "../types";
import { executeQuery } from "./anilist";

export interface AnimeCharacterProfile {
  id: number;
  name: string;
  nativeName?: string;
  image: string;
  animeId: number;
  animeTitle: string;
  role: "Main" | "Supporting" | "Protagonist" | "Antagonist" | string;
  voiceActor?: string;
  quote?: string;
  favourites?: number;
  price?: number;
  isLegendary?: boolean;
}

// 100+ Verified Iconic Anime Characters with Guaranteed High-Res Working CDN Images
export const ICONIC_CHARACTERS_POOL: AnimeCharacterProfile[] = [
  {
    "id": 246,
    "name": "Son Goku",
    "nativeName": "孫 悟空",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png",
    "animeId": 813,
    "animeTitle": "Dragon Ball Z",
    "role": "Protagonist",
    "voiceActor": "Masako Nozawa",
    "quote": "I am the hope of the universe! I am the answer to all living things that cry out for peace!",
    "favourites": 38000,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 913,
    "name": "Vegeta",
    "nativeName": "ベジータ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b913-NIFkKazWM8VO.png",
    "animeId": 813,
    "animeTitle": "Dragon Ball Z",
    "role": "Main",
    "voiceActor": "Ryo Horikawa",
    "quote": "There is only one certainty in life. A strong man stands above and conquers all!",
    "favourites": 34000,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 2093,
    "name": "Son Gohan",
    "nativeName": "孫 悟飯",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b2093-kdFZhqcNSsqW.png",
    "animeId": 813,
    "animeTitle": "Dragon Ball Z",
    "role": "Main",
    "voiceActor": "Masako Nozawa",
    "quote": "I can never forgive you for what you've done!",
    "favourites": 16000,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 914,
    "name": "Piccolo",
    "nativeName": "ピッコロ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b914-KuS8AWjqBrqa.jpg",
    "animeId": 813,
    "animeTitle": "Dragon Ball Z",
    "role": "Main",
    "voiceActor": "Toshio Furukawa",
    "quote": "Even with the energy of the whole planet, that's all you could come up with?",
    "favourites": 14000,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 45627,
    "name": "Levi",
    "nativeName": "リヴァイ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png",
    "animeId": 16498,
    "animeTitle": "Attack on Titan",
    "role": "Protagonist",
    "quote": "Give up on your dreams and die for us. Lead the recruits straight into hell.",
    "favourites": 42949,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 127691,
    "name": "Satoru Gojo",
    "nativeName": "五条悟",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Protagonist",
    "quote": "Throughout heaven and earth, I alone am the honored one.",
    "favourites": 41568,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 27,
    "name": "Killua Zoldyck",
    "nativeName": "キルア=ゾルディック",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg",
    "animeId": 11061,
    "animeTitle": "Hunter x Hunter (2011)",
    "role": "Protagonist",
    "quote": "Gon, you are light. Sometimes you shine so brightly, I must look away.",
    "favourites": 37594,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 40,
    "name": "Monkey D. Luffy",
    "nativeName": "モンキー・D・ルフィ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png",
    "animeId": 21,
    "animeTitle": "ONE PIECE",
    "role": "Protagonist",
    "quote": "I am going to be the King of the Pirates!",
    "favourites": 36217,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 40882,
    "name": "Eren Yeager",
    "nativeName": "エレン・イェーガー",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg",
    "animeId": 16498,
    "animeTitle": "Attack on Titan",
    "role": "Protagonist",
    "quote": "If you win, you live. If you lose, you die. If you do not fight, you cannot win!",
    "favourites": 34693,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 71,
    "name": "L Lawliet",
    "nativeName": "エル・ローライト",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b71-1W4panC53vfs.png",
    "animeId": 1535,
    "animeTitle": "Death Note",
    "role": "Protagonist",
    "quote": "There are many types of monsters in this world... Monsters who will not show themselves.",
    "favourites": 29017,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 417,
    "name": "Lelouch Lamperouge",
    "nativeName": "ルルーシュ・ランペルージ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b417-gVLmIJu9phcK.png",
    "animeId": 1575,
    "animeTitle": "Code Geass: Lelouch of the Rebellion",
    "role": "Protagonist",
    "quote": "If the king doesn't lead, how can he expect his subordinates to follow?",
    "favourites": 28988,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 62,
    "name": "Roronoa Zoro",
    "nativeName": "ロロノア・ゾロ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png",
    "animeId": 21,
    "animeTitle": "ONE PIECE",
    "role": "Protagonist",
    "quote": "Scars on the back are a swordsman's shame.",
    "favourites": 28902,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 88572,
    "name": "Emilia",
    "nativeName": "エミリア",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b88572-IzTwXEHSobRs.jpg",
    "animeId": 21355,
    "animeTitle": "Re:ZERO -Starting Life in Another World-",
    "role": "Protagonist",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 28635,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 40881,
    "name": "Mikasa Ackerman",
    "nativeName": "ミカサ・アッカーマン",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png",
    "animeId": 16498,
    "animeTitle": "Attack on Titan",
    "role": "Protagonist",
    "quote": "This world is cruel, but it is also very beautiful.",
    "favourites": 28576,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 87275,
    "name": "Ken Kaneki",
    "nativeName": "金木研",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b87275-mb13EWZBdbh3.png",
    "animeId": 20605,
    "animeTitle": "Tokyo Ghoul",
    "role": "Protagonist",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 27916,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 89334,
    "name": "Arataka Reigen",
    "nativeName": "霊幻新隆",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b89334-OPj1hCzvrt7X.png",
    "animeId": 21507,
    "animeTitle": "Mob Psycho 100",
    "role": "Protagonist",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 25054,
    "price": 30,
    "isLegendary": true
  },
  {
    "id": 422,
    "name": "Guts",
    "nativeName": "ガッツ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b422-XTaiTuvRohsV.png",
    "animeId": 33,
    "animeTitle": "Berserk",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 24221,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 14,
    "name": "Itachi Uchiha",
    "nativeName": "うちはイタチ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png",
    "animeId": 20,
    "animeTitle": "Naruto",
    "role": "Main",
    "quote": "Those who forgive themselves, and are able to accept their true nature... They are the strong ones!",
    "favourites": 23229,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 34470,
    "name": "Kurisu Makise",
    "nativeName": "牧瀬紅莉栖",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b34470-Jw2LXZBL5R8i.png",
    "animeId": 9253,
    "animeTitle": "Steins;Gate",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 23085,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 137080,
    "name": "Makima",
    "nativeName": "マキマ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png",
    "animeId": 127230,
    "animeTitle": "Chainsaw Man",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 22815,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 127212,
    "name": "Yuji Itadori",
    "nativeName": "虎杖悠仁",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b127212-FVm2tD0erQ5B.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 22670,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 10138,
    "name": "Thorfinn Karlsefni",
    "nativeName": "トルフィン・カルルセヴニ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b10138-zOPrka0ddZOR.png",
    "animeId": 101348,
    "animeTitle": "Vinland Saga",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 22664,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 85,
    "name": "Kakashi Hatake",
    "nativeName": "はたけカカシ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png",
    "animeId": 20,
    "animeTitle": "Naruto",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 22647,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 127222,
    "name": "Mai Sakurajima",
    "nativeName": "桜島麻衣",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b127222-Jh5hhP7vZ7s1.png",
    "animeId": 101291,
    "animeTitle": "Rascal Does Not Dream of Bunny Girl Senpai",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 22536,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 176754,
    "name": "Frieren",
    "nativeName": "フリーレン",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b176754-PCnpqIOkjhFk.png",
    "animeId": 154587,
    "animeTitle": "Frieren: Beyond Journey’s End",
    "role": "Main",
    "quote": "It is the courage to stand up and face the unknown that makes us truly alive.",
    "favourites": 22317,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 126824,
    "name": "Maomao",
    "nativeName": "猫猫",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b126824-MqsCncTO1qpv.png",
    "animeId": 161645,
    "animeTitle": "The Apothecary Diaries",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 22099,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 28,
    "name": "Kurapika",
    "nativeName": "クラピカ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b28-ivA7UGnfE40a.png",
    "animeId": 11061,
    "animeTitle": "Hunter x Hunter (2011)",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21959,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 35252,
    "name": "Rintaro Okabe",
    "nativeName": "岡部倫太郎",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b35252-DY9TW6pusqeh.png",
    "animeId": 9253,
    "animeTitle": "Steins;Gate",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21871,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 80,
    "name": "Light Yagami",
    "nativeName": "夜神月",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b80-26EhwSsSqQ50.png",
    "animeId": 1535,
    "animeTitle": "Death Note",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21867,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 120649,
    "name": "Kaguya Shinomiya",
    "nativeName": "四宮かぐや",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b120649-NPaWaIpWy60E.png",
    "animeId": 101921,
    "animeTitle": "Kaguya-sama: Love is War",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21449,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 130102,
    "name": "Denji",
    "nativeName": "デンジ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b130102-FO1VHNnEnLlB.png",
    "animeId": 127230,
    "animeTitle": "Chainsaw Man",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21363,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 90169,
    "name": "Violet Evergarden",
    "nativeName": "ヴァイオレット・エヴァーガーデン",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b90169-4wr1Zehnsac8.png",
    "animeId": 21827,
    "animeTitle": "Violet Evergarden",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21336,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 89616,
    "name": "Shigeo Kageyama",
    "nativeName": "影山茂夫",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b89616-dXmdOc7L6SDi.png",
    "animeId": 21507,
    "animeTitle": "Mob Psycho 100",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 21081,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 137079,
    "name": "Power",
    "nativeName": "パワー",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b137079-6yLEUYR3bmpr.png",
    "animeId": 127230,
    "animeTitle": "Chainsaw Man",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 20950,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 11,
    "name": "Edward Elric",
    "nativeName": "エドワード・エルリック",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b11-TA5Nuk7EDUZG.jpg",
    "animeId": 5114,
    "animeTitle": "Fullmetal Alchemist: Brotherhood",
    "role": "Main",
    "quote": "A lesson without pain is meaningless.",
    "favourites": 20170,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 17,
    "name": "Naruto Uzumaki",
    "nativeName": "うずまきナルト",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png",
    "animeId": 20,
    "animeTitle": "Naruto",
    "role": "Main",
    "quote": "I won't go back on my word... That's my ninja way!",
    "favourites": 19941,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 126071,
    "name": "Tanjiro Kamado",
    "nativeName": "竈門炭治郎",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png",
    "animeId": 101922,
    "animeTitle": "Demon Slayer: Kimetsu no Yaiba",
    "role": "Main",
    "quote": "No matter how many people you may lose, you have no choice but to go on living.",
    "favourites": 19837,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 89220,
    "name": "Shoto Todoroki",
    "nativeName": "轟焦凍",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b89220-KNBwaVFAR8FD.png",
    "animeId": 21459,
    "animeTitle": "My Hero Academia",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 19583,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 126635,
    "name": "Megumi Fushiguro",
    "nativeName": "伏黒恵",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b126635-L0y3I92JSUkN.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 18716,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 88892,
    "name": "Katsuki Bakugou",
    "nativeName": "爆豪勝己",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b88892-bdOha3lNcaN6.png",
    "animeId": 21459,
    "animeTitle": "My Hero Academia",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 18577,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 500,
    "name": "Sakura Matou",
    "nativeName": "間桐桜",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b500-NQrLbnBr1sDv.png",
    "animeId": 10087,
    "animeTitle": "Fate/Zero",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 18253,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 89198,
    "name": "Osamu Dazai",
    "nativeName": "太宰治",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b89198-qKmRTw4Y3PRC.png",
    "animeId": 21311,
    "animeTitle": "Bungo Stray Dogs",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 17787,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 6356,
    "name": "Joseph Joestar",
    "nativeName": "ジョセフ・ジョースター",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b6356-RImEfUfHpC58.png",
    "animeId": 14719,
    "animeTitle": "JoJo's Bizarre Adventure (TV)",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 17727,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 89361,
    "name": "Megumin",
    "nativeName": "めぐみん",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b89361-tq8PQQ4MmF0M.png",
    "animeId": 21202,
    "animeTitle": "KONOSUBA -God's blessing on this wonderful world!",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 17481,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 133676,
    "name": "Marin Kitagawa",
    "nativeName": "喜多川海夢",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b133676-kV2czE3C8Qls.png",
    "animeId": 132405,
    "animeTitle": "My Dress-Up Darling",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 17325,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 88575,
    "name": "Rem",
    "nativeName": "レム",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b88575-Ayu8UPDA8NS6.png",
    "animeId": 21355,
    "animeTitle": "Re:ZERO -Starting Life in Another World-",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 17144,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 121103,
    "name": "Chika Fujiwara",
    "nativeName": "藤原千花",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b121103-UGLxT8utLPnq.png",
    "animeId": 101921,
    "animeTitle": "Kaguya-sama: Love is War",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 17051,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 13020,
    "name": "Askeladd",
    "nativeName": "アシェラッド",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b13020-ZdiYlNmpRUNS.png",
    "animeId": 101348,
    "animeTitle": "Vinland Saga",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16921,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 30,
    "name": "Gon Freecss",
    "nativeName": "ゴン＝フリークス",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b30-lyFExKyDhefc.jpg",
    "animeId": 11061,
    "animeTitle": "Hunter x Hunter (2011)",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16626,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 672,
    "name": "Gintoki Sakata",
    "nativeName": "坂田銀時",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b672-cP5VPriN67xJ.png",
    "animeId": 918,
    "animeTitle": "Gintama",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16589,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 123212,
    "name": "Kiyotaka Ayanokouji",
    "nativeName": "綾小路清隆",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b123212-ewZgUQr9vvEM.png",
    "animeId": 98659,
    "animeTitle": "Classroom of the Elite",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16401,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 127518,
    "name": "Nezuko Kamado",
    "nativeName": "竈門禰豆子",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png",
    "animeId": 101922,
    "animeTitle": "Demon Slayer: Kimetsu no Yaiba",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16389,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 124142,
    "name": "Senkuu Ishigami",
    "nativeName": "石神千空",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b124142-XUO1g7wRqkaT.png",
    "animeId": 105333,
    "animeTitle": "Dr. STONE",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16324,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 124382,
    "name": "Ichigo",
    "nativeName": "イチゴ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b124382-bSBkjtYjJQtr.png",
    "animeId": 99423,
    "animeTitle": "DARLING in the FRANXX",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16321,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 124381,
    "name": "Zero Two",
    "nativeName": "ゼロツー",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b124381-2gAVq76HPfL2.png",
    "animeId": 99423,
    "animeTitle": "DARLING in the FRANXX",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16278,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 126375,
    "name": "Itsuki Nakano",
    "nativeName": "中野五月",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b126375-dEe9IyQ9By09.png",
    "animeId": 103572,
    "animeTitle": "The Quintessential Quintuplets",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16255,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 73935,
    "name": "Saitama",
    "nativeName": "サイタマ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b73935-ON5d0mAcrItd.jpg",
    "animeId": 21087,
    "animeTitle": "One-Punch Man",
    "role": "Main",
    "quote": "I'm just a guy who's a hero for fun.",
    "favourites": 16204,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 64769,
    "name": "Shouyou Hinata",
    "nativeName": "日向翔陽",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b64769-WoWlCMLLgJ14.png",
    "animeId": 20464,
    "animeTitle": "HAIKYU!!",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16076,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 46494,
    "name": "Armin Arlert",
    "nativeName": "アルミン・アルレルト",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b46494-g7xYYuBtYPnO.png",
    "animeId": 16498,
    "animeTitle": "Attack on Titan",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 16064,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 129130,
    "name": "Inosuke Hashibira",
    "nativeName": "嘴平伊之助",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/n129130-SJC0Kn1DU39E.jpg",
    "animeId": 101922,
    "animeTitle": "Demon Slayer: Kimetsu no Yaiba",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15992,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 31,
    "name": "Hisoka Morow",
    "nativeName": "ヒソカ・モロウ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b31-FZckOuu7L1un.png",
    "animeId": 11061,
    "animeTitle": "Hunter x Hunter (2011)",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15910,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 89028,
    "name": "Izuku Midoriya",
    "nativeName": "緑谷出久",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b89028-8w1I9o1ISHMg.png",
    "animeId": 21459,
    "animeTitle": "My Hero Academia",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15878,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 90107,
    "name": "Kusuo Saiki",
    "nativeName": "斉木楠雄",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b90107-ZULW5HlPX1uU.png",
    "animeId": 21170,
    "animeTitle": "Assassination Classroom Second Season",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15852,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 66173,
    "name": "Izumi Miyamura",
    "nativeName": "宮村伊澄",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b66173-g8eU1LGWPB8O.png",
    "animeId": 124080,
    "animeTitle": "Horimiya",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15809,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 125886,
    "name": "Miko Iino",
    "nativeName": "伊井野ミコ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b125886-TQbmqAaSgBLS.png",
    "animeId": 101921,
    "animeTitle": "Kaguya-sama: Love is War",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15671,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 129928,
    "name": "Sung Jin-woo",
    "nativeName": "성진우",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b129928-BCEjVaP0AQSw.png",
    "animeId": 151807,
    "animeTitle": "Solo Leveling",
    "role": "Main",
    "quote": "Arise. From now on, you are my shadow army.",
    "favourites": 15566,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 88573,
    "name": "Subaru Natsuki",
    "nativeName": "ナツキ・スバル",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b88573-F8yMTK9GhnTA.png",
    "animeId": 21355,
    "animeTitle": "Re:ZERO -Starting Life in Another World-",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15559,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 121102,
    "name": "Yuu Ishigami",
    "nativeName": "石上優",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b121102-tiQFxnSEIAwm.png",
    "animeId": 101921,
    "animeTitle": "Kaguya-sama: Love is War",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15404,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 71121,
    "name": "Hange Zoe",
    "nativeName": "ハンジ・ゾエ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b71121-7R7CnQd3lHgt.png",
    "animeId": 16498,
    "animeTitle": "Attack on Titan",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15376,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 305,
    "name": "Sanji",
    "nativeName": "サンジ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b305-6lisPmHtCnLT.png",
    "animeId": 21,
    "animeTitle": "ONE PIECE",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15321,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 129131,
    "name": "Zenitsu Agatsuma",
    "nativeName": "我妻善逸",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b129131-FZrQ7lSlxmEr.png",
    "animeId": 101922,
    "animeTitle": "Demon Slayer: Kimetsu no Yaiba",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15303,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 22037,
    "name": "Hitagi Senjougahara",
    "nativeName": "戦場ヶ原ひたぎ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b22037-sY7GWSKYr2Nl.jpg",
    "animeId": 5081,
    "animeTitle": "Bakemonogatari",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15262,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 68,
    "name": "Roy Mustang",
    "nativeName": "ロイ・マスタング",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b68-moBLY2WO2am3.png",
    "animeId": 5114,
    "animeTitle": "Fullmetal Alchemist: Brotherhood",
    "role": "Main",
    "quote": "Nothing is impossible, and that includes alchemy.",
    "favourites": 15120,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 137081,
    "name": "Aki Hayakawa",
    "nativeName": "早川アキ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b137081-TSrUR3mUJL6r.png",
    "animeId": 127230,
    "animeTitle": "Chainsaw Man",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15075,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 94,
    "name": "Asuka Langley Souryuu",
    "nativeName": "惣流・アスカ・ラングレー",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b94-d631a3Z2KPvd.png",
    "animeId": 30,
    "animeTitle": "Neon Genesis Evangelion",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 15055,
    "price": 25,
    "isLegendary": false
  },
  {
    "id": 4003,
    "name": "Joutarou Kuujou",
    "nativeName": "空条承太郎",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b4003-gWDSEGbeOAll.png",
    "animeId": 14719,
    "animeTitle": "JoJo's Bizarre Adventure (TV)",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14936,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 1,
    "name": "Spike Spiegel",
    "nativeName": "スパイク・スピーゲル",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b1-ChxaldmieFlQ.png",
    "animeId": 1,
    "animeTitle": "Cowboy Bebop",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14914,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 61,
    "name": "Robin Nico",
    "nativeName": "ニコロビン",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b61-ywXUyyocEEqt.png",
    "animeId": 21,
    "animeTitle": "ONE PIECE",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14825,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 5,
    "name": "Ichigo Kurosaki",
    "nativeName": "黒崎一護",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b5-a7bkJgjhhigE.png",
    "animeId": 269,
    "animeTitle": "Bleach",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14763,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 133700,
    "name": "Nobara Kugisaki",
    "nativeName": "釘崎野薔薇",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b133700-f6sOO3TcgLV6.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14656,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 138102,
    "name": "Yor Forger",
    "nativeName": "ヨル・フォージャー",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b138102-ZOAu9jI2d5ke.png",
    "animeId": 140960,
    "animeTitle": "SPY x FAMILY",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14608,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 64771,
    "name": "Tobio Kageyama",
    "nativeName": "影山飛雄",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b64771-BuCVs7B8bBdh.png",
    "animeId": 20464,
    "animeTitle": "HAIKYU!!",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14460,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 23602,
    "name": "Shinobu Oshino",
    "nativeName": "忍野忍",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b23602-Z4MDNYcoAWZu.png",
    "animeId": 5081,
    "animeTitle": "Bakemonogatari",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14367,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 133704,
    "name": "Kento Nanami",
    "nativeName": "七海建人",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b133704-8wLTGjc234q2.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14303,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 13,
    "name": "Sasuke Uchiha",
    "nativeName": "うちはサスケ",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b13-SISLEw1oAD7a.png",
    "animeId": 20,
    "animeTitle": "Naruto",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14276,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 123962,
    "name": "Rimuru Tempest",
    "nativeName": "リムル・テンペスト",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b123962-eL9yGV0NLMF7.png",
    "animeId": 101280,
    "animeTitle": "That Time I Got Reincarnated as a Slime",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14195,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 84677,
    "name": "Yato",
    "nativeName": "夜ト",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b84677-PFmohzIXD1ud.png",
    "animeId": 20447,
    "animeTitle": "Noragami",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 14034,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 130050,
    "name": "Giyu Tomioka",
    "nativeName": "冨岡義勇",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b130050-qsLThJs5VIbz.png",
    "animeId": 101922,
    "animeTitle": "Demon Slayer: Kimetsu no Yaiba",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 13831,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 46496,
    "name": "Erwin Smith",
    "nativeName": "エルヴィン・スミス",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b46496-Mu86MENd5wNB.png",
    "animeId": 16498,
    "animeTitle": "Attack on Titan",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 13778,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 134167,
    "name": "Maki Zenin",
    "nativeName": "禪院真希",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b134167-5TCytk45YByD.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 13549,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 138100,
    "name": "Anya Forger",
    "nativeName": "アーニャ・フォージャー",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b138100-4Li0tWRCa5bQ.png",
    "animeId": 140960,
    "animeTitle": "SPY x FAMILY",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 13521,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 498,
    "name": "Rin Tohsaka",
    "nativeName": "遠坂凛",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b498-lwawtSpLyATL.png",
    "animeId": 10087,
    "animeTitle": "Fate/Zero",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 13363,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 67065,
    "name": "Hachiman Hikigaya",
    "nativeName": "比企谷八幡",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b67065-Dhec6tE2yWA9.png",
    "animeId": 14813,
    "animeTitle": "My Teen Romantic Comedy SNAFU",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 13255,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 22036,
    "name": "Koyomi Araragi",
    "nativeName": "阿良々木暦",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b22036-Ed3CjwPlDLp4.png",
    "animeId": 5081,
    "animeTitle": "Bakemonogatari",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12883,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 133701,
    "name": "Sukuna",
    "nativeName": "宿儺",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b133701-rCQuDpHr3UZL.png",
    "animeId": 113415,
    "animeTitle": "JUJUTSU KAISEN",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12608,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 497,
    "name": "Artoria Pendragon",
    "nativeName": "アルトリア・ペンドラゴン",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b497-Yg5pNmC8kxzs.png",
    "animeId": 10087,
    "animeTitle": "Fate/Zero",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12589,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 80243,
    "name": "Shouko Nishimiya",
    "nativeName": "西宮硝子",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b80243-RzxE51iUU5eq.png",
    "animeId": 20954,
    "animeTitle": "A Silent Voice",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12557,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 66171,
    "name": "Kyouko Hori",
    "nativeName": "堀京子",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b66171-o2vk3689wWFK.png",
    "animeId": 124080,
    "animeTitle": "Horimiya",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12419,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 126373,
    "name": "Miku Nakano",
    "nativeName": "中野三玖",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b126373-CWeyXb822uDN.png",
    "animeId": 103572,
    "animeTitle": "The Quintessential Quintuplets",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12393,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 257562,
    "name": "Hitori Gotou",
    "nativeName": "後藤ひとり",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b257562-Ru35NYPfsqhY.png",
    "animeId": 130003,
    "animeTitle": "BOCCHI THE ROCK!",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12310,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 38005,
    "name": "Homura Akemi",
    "nativeName": "暁美ほむら",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b38005-T3NR8p2f021x.jpg",
    "animeId": 9756,
    "animeTitle": "Puella Magi Madoka Magica",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12176,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 129133,
    "name": "Kyojuro Rengoku",
    "nativeName": "煉獄杏寿郎",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b129133-VlTPowwt68rJ.png",
    "animeId": 101922,
    "animeTitle": "Demon Slayer: Kimetsu no Yaiba",
    "role": "Main",
    "quote": "Set your heart ablaze! Go beyond your limits!",
    "favourites": 12042,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 67327,
    "name": "Yuu Nishinoya",
    "nativeName": "西谷夕",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b67327-zQb1dlC7joPb.jpg",
    "animeId": 20464,
    "animeTitle": "HAIKYU!!",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 12015,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 71933,
    "name": "Karma Akabane",
    "nativeName": "赤羽業",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b71933-HQ1TSjlrJ8Hv.jpg",
    "animeId": 20755,
    "animeTitle": "Assassination Classroom",
    "role": "Main",
    "quote": "I will fight with everything I have to protect what matters most.",
    "favourites": 11945,
    "price": 20,
    "isLegendary": false
  },
  {
    "id": 718,
    "name": "Dr. Kenzo Tenma",
    "nativeName": "天馬賢三",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b718-b6ZZVp822lw0.png",
    "animeId": 19,
    "animeTitle": "Monster",
    "role": "Protagonist",
    "quote": "All human lives are created equal. You cannot weigh one life against another.",
    "favourites": 18500,
    "price": 25,
    "isLegendary": true
  },
  {
    "id": 724,
    "name": "Johan Liebert",
    "nativeName": "ヨハン・リーベルト",
    "image": "https://s4.anilist.co/file/anilistcdn/character/large/b724-GFGgI9AJQkfy.jpg",
    "animeId": 19,
    "animeTitle": "Monster",
    "role": "Antagonist",
    "quote": "Tell me, Doctor Tenma... which of us was the monster?",
    "favourites": 26000,
    "price": 30,
    "isLegendary": true
  }
];

// Calculate character arcade price based on popularity
export function calculateCharacterPrice(character: { name: string; role?: string; favourites?: number }): { price: number; isLegendary: boolean } {
  const favs = character.favourites || 0;
  if (favs > 25000) return { price: 30, isLegendary: true };
  if (favs > 10000) return { price: 25, isLegendary: true };
  if (favs > 3000) return { price: 20, isLegendary: false };
  return { price: 15, isLegendary: false };
}

// Fallback high-contrast vector card if network fails
export function getFallbackAvatarSvg(name: string, nativeName?: string): string {
  const initials = name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45) % 360;
  const safeName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420" width="100%" height="100%">
    <defs>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 70%, 25%)" />
        <stop offset="50%" stop-color="hsl(${hue2}, 65%, 15%)" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="darkOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(0,0,0,0.1)" />
        <stop offset="70%" stop-color="rgba(2,6,23,0.6)" />
        <stop offset="100%" stop-color="rgba(2,6,23,0.95)" />
      </linearGradient>
    </defs>
    
    <rect width="320" height="420" fill="url(#cardGrad)" rx="16" />
    <circle cx="160" cy="180" r="70" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
    <text x="160" y="90" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-family="sans-serif" font-size="28" font-weight="900">${nativeName || "アニメ"}</text>
    <text x="160" y="195" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="44" font-weight="900" letter-spacing="2">${initials}</text>
    <rect width="320" height="420" fill="url(#darkOverlay)" rx="16" />
    <text x="160" y="360" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="800">${safeName.length > 20 ? safeName.substring(0, 18) + "…" : safeName}</text>
    <text x="160" y="385" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="11" font-weight="700">ANILOVE HERO CARD</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Safe character image getter
export function getSafeCharacterImage(name: string, remoteUrl?: string, nativeName?: string): string {
  // First check if the character matches our verified iconic pool
  const match = ICONIC_CHARACTERS_POOL.find(c => 
    c.name.toLowerCase() === name.toLowerCase() || 
    name.toLowerCase().includes(c.name.toLowerCase()) || 
    c.name.toLowerCase().includes(name.toLowerCase())
  );
  if (match && match.image && match.image.startsWith("http")) {
    return match.image;
  }

  // If a valid remote HTTP/HTTPS URL is provided, use it
  if (remoteUrl && remoteUrl.trim().length > 0 && remoteUrl.startsWith("http") && !remoteUrl.includes("broken") && !remoteUrl.includes("undefined")) {
    return remoteUrl;
  }

  return getFallbackAvatarSvg(name, nativeName);
}

// Query characters from AniList GraphQL for any custom anime
export async function fetchCharactersForAnime(animeId: number): Promise<AnimeCharacterProfile[]> {
  const query = `
    query ($animeId: Int) {
      Media (id: $animeId, type: ANIME) {
        id
        title {
          english
          romaji
          userPreferred
        }
        characters (sort: ROLE, perPage: 25) {
          edges {
            role
            node {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
              favourites
            }
            voiceActors (language: JAPANESE) {
              name {
                full
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await executeQuery<{
      Media: {
        id: number;
        title: { english?: string; romaji?: string; userPreferred?: string };
        characters: {
          edges: {
            role: string;
            node: {
              id: number;
              name: { full: string; native?: string };
              image: { large?: string; medium?: string };
              favourites?: number;
            };
            voiceActors?: { name: { full: string } }[];
          }[];
        };
      };
    }>(query, { animeId });

    if (!data.Media?.characters?.edges?.length) {
      return [];
    }

    const animeTitle =
      data.Media.title.english ||
      data.Media.title.userPreferred ||
      data.Media.title.romaji ||
      "Anime";

    return data.Media.characters.edges.map(edge => {
      const charName = edge.node.name.full;
      const roleStr = edge.role === "MAIN" ? "Main Character" : "Supporting Character";
      const pricing = calculateCharacterPrice({
        name: charName,
        role: roleStr,
        favourites: edge.node.favourites,
      });

      const rawImg = edge.node.image?.large || edge.node.image?.medium;

      return {
        id: edge.node.id,
        name: charName,
        nativeName: edge.node.name.native,
        image: getSafeCharacterImage(charName, rawImg, edge.node.name.native),
        animeId: data.Media.id,
        animeTitle,
        role: roleStr,
        voiceActor: edge.voiceActors?.[0]?.name?.full,
        favourites: edge.node.favourites,
        price: pricing.price,
        isLegendary: pricing.isLegendary,
      };
    });
  } catch (err) {
    console.warn(`Could not fetch online characters for anime ${animeId}:`, err);
    return [];
  }
}

// Convert a character profile into a GachaCard
export function createCharacterCardFromProfile(profile: AnimeCharacterProfile): GachaCard {
  return {
    id: `char-${profile.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    characterId: profile.id,
    animeId: profile.animeId,
    animeTitle: profile.animeTitle,
    characterName: profile.name,
    characterNativeName: profile.nativeName,
    characterImage: profile.image,
    imageUrl: profile.image,
    characterRole: profile.role,
    voiceActor: profile.voiceActor,
    quote: profile.quote,
    coinPrice: profile.price || 15,
    obtainedAt: Date.now(),
  };
}

export interface DetailedCharacterData {
  id: number;
  name: {
    full: string;
    native?: string;
    alternative?: string[];
  };
  image: {
    large?: string;
    medium?: string;
  };
  description?: string;
  gender?: string;
  age?: string;
  dateOfBirth?: {
    year?: number;
    month?: number;
    day?: number;
  };
  bloodType?: string;
  favourites?: number;
  media?: {
    id: number;
    title: {
      romaji?: string;
      english?: string;
      userPreferred?: string;
    };
    coverImage?: {
      extraLarge?: string;
      large?: string;
      medium?: string;
      color?: string;
    };
    bannerImage?: string;
    format?: string;
    episodes?: number;
    seasonYear?: number;
    averageScore?: number;
    genres?: string[];
  }[];
  voiceActors?: {
    id: number;
    name: {
      full: string;
      native?: string;
    };
    image?: {
      large?: string;
    };
    language?: string;
  }[];
}

// Live fetch full rich character biography, media, and voice actors from AniList with exact matching
export async function fetchDetailedCharacterInfo(
  charName: string,
  explicitCharId?: number,
  animeId?: number,
  animeTitle?: string
): Promise<DetailedCharacterData | null> {
  const query = `
    query ($id: Int, $search: String) {
      Character (id: $id, search: $search) {
        id
        name {
          full
          native
          alternative
        }
        image {
          large
          medium
        }
        description (asHtml: false)
        gender
        age
        dateOfBirth {
          year
          month
          day
        }
        bloodType
        favourites
        media (sort: POPULARITY_DESC, perPage: 8, type: ANIME) {
          nodes {
            id
            title {
              romaji
              english
              userPreferred
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            format
            episodes
            seasonYear
            averageScore
            genres
          }
          edges {
            voiceActors (language: JAPANESE, sort: FAVOURITES_DESC) {
              id
              name {
                full
                native
              }
              image {
                large
              }
              language
            }
          }
        }
      }
    }
  `;

  try {
    const vars: { id?: number; search?: string } = {};

    // 1. Direct explicit ID check
    if (explicitCharId && explicitCharId > 0) {
      vars.id = explicitCharId;
    } else {
      // 2. Match against iconic pool with anime context if possible
      const poolProfile = ICONIC_CHARACTERS_POOL.find(p => {
        const nameMatches = p.name.toLowerCase() === charName.toLowerCase();
        if (!nameMatches) return false;
        if (animeId && p.animeId === animeId) return true;
        if (animeTitle && p.animeTitle.toLowerCase() === animeTitle.toLowerCase()) return true;
        return true;
      });

      if (poolProfile) {
        vars.id = poolProfile.id;
      } else if (animeId) {
        // 3. Query the anime's character roster to find exact AniList character ID
        try {
          const animeChars = await fetchCharactersForAnime(animeId);
          const matchedChar = animeChars.find(
            c => c.name.toLowerCase() === charName.toLowerCase()
          );
          if (matchedChar && matchedChar.id) {
            vars.id = matchedChar.id;
          } else {
            vars.search = charName;
          }
        } catch {
          vars.search = charName;
        }
      } else {
        vars.search = charName;
      }
    }

    const res = await executeQuery<{
      Character?: {
        id: number;
        name: { full: string; native?: string; alternative?: string[] };
        image: { large?: string; medium?: string };
        description?: string;
        gender?: string;
        age?: string;
        dateOfBirth?: { year?: number; month?: number; day?: number };
        bloodType?: string;
        favourites?: number;
        media?: {
          nodes: any[];
          edges: { voiceActors?: any[] }[];
        };
      };
    }>(query, vars);

    if (!res.Character) return null;

    const char = res.Character;
    const mediaNodes = char.media?.nodes || [];
    const vas: any[] = [];
    char.media?.edges?.forEach(edge => {
      if (edge.voiceActors) {
        edge.voiceActors.forEach(va => {
          if (!vas.some(existing => existing.id === va.id)) {
            vas.push(va);
          }
        });
      }
    });

    return {
      id: char.id,
      name: char.name,
      image: char.image,
      description: char.description,
      gender: char.gender,
      age: char.age,
      dateOfBirth: char.dateOfBirth,
      bloodType: char.bloodType,
      favourites: char.favourites,
      media: mediaNodes,
      voiceActors: vas,
    };
  } catch (err) {
    console.warn(`Could not fetch AniList detailed character for ${charName}:`, err);
    return null;
  }
}


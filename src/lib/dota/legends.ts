// GOAT's 传奇: retired and semi-retired players worth a page of their own — every TI champion, and a
// few icons who never won one. Kept by hand: no API says who is a legend. Each account id here was
// checked on STRATZ (its pro name or real name); people whose account isn't confirmed yet are left
// out (see MISSING) rather than guessed. Whether someone still plays is worked out at run time (on an
// active GOAT roster: 现役, hidden by default; recent matches: still playing).

export type Legend = {
  // As the scene knows them.
  name: string;
  real: string;
  // The main account (more can follow: alts).
  accounts: number[];
  // The Internationals they won, by year, and with which team.
  ti: { year: number; team: string }[];
  // For the icons without a TI: what they're known for.
  known?: { zh: string; en: string };
};

const champions = (year: number, team: string, players: [string, string, number][]): Legend[] =>
  players.map(([name, real, account]) => ({ name, real, accounts: [account], ti: [{ year, team }] }));

const LIST: Legend[] = [
  ...champions(2011, "Natus Vincere", [
    ["Dendi", "Danylo Ishutin", 70388657],
    ["Puppey", "Clement Ivanov", 87278757],
  ]),
  ...champions(2012, "Invictus Gaming", [
    ["Zhou", "Chen Yao", 90137663],
    ["ChuaN", "Wong Hock Chuan", 88553213],
    ["Faith", "Zeng Hongda", 82327674],
  ]),
  ...champions(2013, "Alliance", [
    ["s4", "Gustav Magnusson", 41231571],
    ["EGM", "Jerry Lundkvist", 3916428],
    ["Akke", "Joakim Akterhall", 41288955],
  ]),
  ...champions(2014, "Newbee", [["Hao", "Chen Zhihao", 88508515]]),
  ...champions(2015, "Evil Geniuses", [
    ["Fear", "Clinton Loomis", 87177591],
    ["SumaiL", "Syed Sumail Hassan", 111620041],
    ["Aui_2000", "Kurtis Ling", 40547474],
    ["ppd", "Peter Dager", 86727555],
  ]),
  ...champions(2016, "Wings Gaming", [
    ["shadow", "Chu Zeyu", 129585121],
    ["bLink", "Zhou Yang", 101586543],
    ["Faith_bian", "Zhang Ruida", 118134220],
    ["y`", "Zhang Yiping", 111114687],
    ["iceice", "Li Peng", 102644565],
  ]),
  ...champions(2017, "Team Liquid", [
    ["MATUMBAMAN", "Lasse Urpalainen", 72312627],
    ["Miracle-", "Amer Al-Barkawi", 105248644],
    ["MinD_ContRoL", "Ivan Ivanov", 34505203],
    ["GH", "Maroun Merhej", 101356886],
    ["KuroKy", "Kuro Salehi Takhasomi", 82262664],
  ]),
  // OG won both TI8 and TI9 with the same five.
  ...(
    [
      ["ana", "Anathan Pham", 311360822],
      ["Topson", "Topias Taavitsainen", 94054712],
      ["Ceb", "Sébastien Debs", 88271237],
      ["JerAx", "Jesse Vainikka", 26771994],
      ["N0tail", "Johan Sundstein", 19672354],
    ] as [string, string, number][]
  ).map(([name, real, account]) => ({
    name,
    real,
    accounts: [account],
    ti: [
      { year: 2018, team: "OG" },
      { year: 2019, team: "OG" },
    ],
  })),
  // Spirit's names are Valve-locked in OpenDota's register (their official names).
  ...champions(2021, "Team Spirit", [
    ["TORONTOTOKYO", "Alexander Khertek", 431770905],
    ["Miposhka", "Yaroslav Naidenov", 113331514],
  ]),
  ...champions(2022, "Tundra Esports", [
    ["skiter", "Oliver Lepko", 100058342],
    ["Nine", "Leon Kirilin", 94786276],
    ["33", "Neta Shapira", 86698277],
    ["Saksa", "Martin Sazdov", 103735745],
    ["Sneyking", "Wu Jingjun", 10366616],
  ]),
  // Spirit won TI10 and TI12 with Yatoro, Collapse and Mira: both years.
  ...(
    [
      ["Yatoro", "Illya Mulyarchuk", 321580662],
      ["Collapse", "Magomed Khalilov", 302214028],
      ["Mira", "Miroslav Kolpakov", 256156323],
    ] as [string, string, number][]
  ).map(([name, real, account]) => ({
    name,
    real,
    accounts: [account],
    ti: [
      { year: 2021, team: "Team Spirit" },
      { year: 2023, team: "Team Spirit" },
    ],
  })),
  ...champions(2023, "Team Spirit", [["Larl", "Denis Sigitov", 106305042]]),
  ...champions(2024, "Team Liquid", [
    ["miCKe", "Michael Vu", 152962063],
    ["Nisha", "Michał Jankowski", 201358612],
    ["zai", "Ludwig Wåhlberg", 73562326],
    ["Boxi", "Samuel Svahn", 77490514],
    ["iNSaNiA", "Aydin Sarkohi", 54580962],
  ]),
  {
    name: "Arteezy",
    real: "Artour Babaev",
    accounts: [86745912],
    ti: [],
    known: {
      zh: "EG、Secret 的明星核心，北美最具代表性的选手之一",
      en: "Star carry of EG and Secret, one of North America's defining players",
    },
  },
];

// Champions still on a top team (most of TI10 onwards) are in the list too, hidden by default as
// 现役. Champions whose account isn't confirmed:
// XBOCT, ArtStyle, LighTofHeaveN (TI1), Ferrari_430, YYF (TI2), AdmiralBulldog, Loda (TI3), Mu,
// xiao8, Banana, SanSheng (TI4), UNiVeRsE (TI5); and the icons BurNing, Merlini.
export const MISSING = [
  "XBOCT",
  "ArtStyle",
  "LighTofHeaveN",
  "Ferrari_430",
  "YYF",
  "AdmiralBulldog",
  "Loda",
  "Mu",
  "xiao8",
  "Banana",
  "SanSheng",
  "UNiVeRsE",
  "BurNing",
  "Merlini",
];

// Second accounts, found later (the first one is what the page links to).
const ALTS: Record<string, number[]> = { Nisha: [121769650] };

export const LEGENDS: Legend[] = LIST.map((l) => ({
  ...l,
  accounts: [...l.accounts, ...(ALTS[l.name] ?? [])],
}));

// The era of a legend, by their first TI (or none: the icons).
export type Era = "early" | "middle" | "recent" | "icon";
export function eraOf(l: Legend): Era {
  const first = l.ti[0]?.year;
  if (!first) return "icon";
  if (first <= 2014) return "early";
  if (first <= 2019) return "middle";
  return "recent";
}

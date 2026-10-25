export type Answer = { text: string; points: number };

export type Question = {
  prompt: string;
  multiplier: number;
  answers: Answer[];
};

export const questions: Question[] = [
  {
    prompt: "Name an excuse Filipino would give for being late?",
    multiplier: 1,
    answers: [
      { text: "Traffic", points: 41 },
      { text: "Nakalimutan ko", points: 16 },
      { text: "Tinanghali ng Gising", points: 12 },
      { text: "Umuulan", points: 10 },
      { text: "Walang masakyan", points: 7 },
      { text: "Di ko narinig alarm", points: 5 },
      { text: "May tinapos pa sa bahay", points: 4 },
      { text: "May dinaanan pa kasi ako", points: 3 },
    ],
  },
  {
    prompt: "Give me Top 7 most mentioned names that start with letter J in the bible?",
    multiplier: 1,
    answers: [
      { text: "Jesus", points: 35 },
      { text: "Judah", points: 14 },
      { text: "Jacob", points: 13 },
      { text: "Joseph", points: 10 },
      { text: "Joshua", points: 8 },
      { text: "Jonathan", points: 5 },
      { text: "Jeremiah", points: 4 },
    ],
  },
  {
    prompt: "Give house appliances that spins?",
    multiplier: 2,
    answers: [
      { text: "Washing Machine", points: 32 },
      { text: "Electric Fan", points: 24 },
      { text: "Blender", points: 14 },
      { text: "Microwave", points: 11 },
      { text: "Mixers/Beaters", points: 7 },
      { text: "Ceiling Fan", points: 6 },
    ],
  },
  {
    prompt: "Magbigay ng bagay na sinusubo pero di nilulunok",
    multiplier: 3,
    answers: [
      { text: "Bubble Gum", points: 28 },
      { text: "Kutsara/Tinidor", points: 19 },
      { text: "Buto ng Prutas", points: 15 },
      { text: "Lollipop", points: 12 },
      { text: "Toothbrush", points: 11 },
      { text: "Lapis/Pen", points: 7 },
    ],
  },
];

export type THomeStatsResponse = {
  ok: true;
  scope: "home";
  homeViews: number;
  likes: number;
  shares: number;
};

export type TTermStatsResponse = {
  ok: true;
  term: string;
  views: number;
  likes: number;
  shares: number;
};

export type TStatsErrorResponse = {
  ok: false;
  error: string;
  message: string;
};

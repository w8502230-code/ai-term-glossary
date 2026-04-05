export type TDefineResponse =
  | {
      ok: true;
      term: string;
      professionalZh: string;
      professionalEn: string;
      plainZh: string;
    }
  | {
      ok: false;
      error: string;
      message: string;
    };

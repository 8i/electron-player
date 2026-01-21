import { partial } from "filesize";

export const getHumanFileSize = partial({
  base: 10,
  locale: "en",
  symbols: { kB: "KB" },
});

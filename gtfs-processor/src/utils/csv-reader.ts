import { parse } from "csv-parse";
import { createReadStream } from "node:fs";

export type CsvRecord<Required extends string = never, Optional extends string = never> = {
  [key in Required]: string;
} & { [key in Optional]?: string };

type ReadCsvOptions = {
  delimiter?: string;
  encoding?: BufferEncoding;
};

export function readCsv<T extends CsvRecord<string>>(
  path: string,
  onRecord: (record: T) => void,
  { delimiter, encoding }: ReadCsvOptions = {},
) {
  const readStream = createReadStream(path, { encoding });
  const parser = readStream.pipe(
    parse({ bom: true, columns: true, delimiter, skipEmptyLines: true }),
  );

  parser.on("data", onRecord);
  return new Promise((resolve, reject) => {
    parser.once("end", resolve);
    parser.once("error", reject);
  });
}
